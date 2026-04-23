import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D134: storage 고아 파일 정리.
 *
 * 대상 버킷/규칙:
 *   - campaign-assets: campaigns.thumbnail_url/og_image_url 또는 campaign_assets 테이블에서 참조 중인 파일만 유지
 *   - receipts: receipts.pdf_url 에서 참조 중인 파일만 유지
 *
 * 안전장치:
 *   - DRY-RUN 기본(삭제는 ?execute=1 또는 PURGE_ORPHAN_EXECUTE=1 일 때만)
 *   - 최근 7일 내 업로드 파일은 건드리지 않음 (업로드 직후 DB row 연결 대기 중일 수 있음)
 *   - 한 번 실행 당 최대 200개로 제한
 *
 * 스케줄 권장: 월 1회 (vercel.json 또는 수동 실행)
 */

const MAX_DELETE = 200;
const MIN_AGE_DAYS = 7;

export async function GET(req: Request) {
  return runCron(req, "cron:purge-orphan-storage", async () => {
    const url = new URL(req.url);
    const execute =
      url.searchParams.get("execute") === "1" ||
      process.env.PURGE_ORPHAN_EXECUTE === "1";
    const supabase = createSupabaseAdminClient();

    const result = {
      campaignAssets: await scanBucket(
        supabase,
        "campaign-assets",
        await getCampaignAssetReferences(supabase),
        execute
      ),
      receipts: await scanBucket(
        supabase,
        "receipts",
        await getReceiptReferences(supabase),
        execute
      ),
      executed: execute,
    };
    return result as unknown as Record<string, number | string | boolean>;
  });
}

async function scanBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  refSet: Set<string>,
  execute: boolean
): Promise<{ scanned: number; orphaned: number; deleted: number }> {
  const { data: list, error } = await supabase.storage
    .from(bucket)
    .list(undefined, { limit: 1000, offset: 0 });
  if (error || !list) {
    return { scanned: 0, orphaned: 0, deleted: 0 };
  }

  const now = Date.now();
  const minAgeMs = MIN_AGE_DAYS * 86400000;
  let orphaned = 0;
  let deleted = 0;
  const toDelete: string[] = [];

  for (const f of list) {
    if (!f.name) continue;
    // list 는 top-level만 반환 — 버킷이 깊은 경로 구조면 재귀 필요
    const path = f.name;
    const created = f.created_at
      ? new Date(f.created_at).getTime()
      : now;
    if (now - created < minAgeMs) continue;
    if (refSet.has(path)) continue;
    orphaned++;
    if (toDelete.length < MAX_DELETE) toDelete.push(path);
  }

  if (execute && toDelete.length > 0) {
    const { error: delErr } = await supabase.storage
      .from(bucket)
      .remove(toDelete);
    if (!delErr) deleted = toDelete.length;
  }

  return { scanned: list.length, orphaned, deleted };
}

async function getCampaignAssetReferences(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<Set<string>> {
  const set = new Set<string>();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("thumbnail_url, og_image_url");
  for (const c of (campaigns ?? []) as Array<{
    thumbnail_url: string | null;
    og_image_url: string | null;
  }>) {
    if (c.thumbnail_url) addPathFromPublicUrl(set, c.thumbnail_url);
    if (c.og_image_url) addPathFromPublicUrl(set, c.og_image_url);
  }
  const { data: assets } = await supabase
    .from("campaign_assets")
    .select("storage_path");
  for (const a of (assets ?? []) as Array<{ storage_path: string | null }>) {
    if (a.storage_path) set.add(a.storage_path);
  }
  return set;
}

async function getReceiptReferences(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<Set<string>> {
  const set = new Set<string>();
  const { data } = await supabase.from("receipts").select("pdf_url, receipt_code, year, org_id");
  for (const r of (data ?? []) as Array<{
    pdf_url: string | null;
    receipt_code: string;
    year: number;
    org_id: string;
  }>) {
    // 두 가지 형태 모두 인정
    set.add(`${r.org_id}/${r.year}/${r.receipt_code}.pdf`);
    if (r.pdf_url) addPathFromPublicUrl(set, r.pdf_url);
  }
  return set;
}

function addPathFromPublicUrl(set: Set<string>, url: string) {
  // Supabase public URL 은 .../storage/v1/object/public/{bucket}/{path}
  const idx = url.indexOf("/object/public/");
  if (idx === -1) return;
  const tail = url.slice(idx + "/object/public/".length);
  const slash = tail.indexOf("/");
  if (slash === -1) return;
  set.add(tail.slice(slash + 1));
}
