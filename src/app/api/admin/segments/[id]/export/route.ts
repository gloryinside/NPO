import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { kstToday } from "@/lib/billing/kst";
import { TIER_LABEL, loadSegmentMembers, parseSegmentFilter, safeCsvText, segmentMemberIds } from "@/lib/members/segments";

type Ctx = { params: Promise<{ id: string }> };

/** GET — 저장된 명단을 엑셀(CSV)로. 최대 10,000명, 주민번호 제외. 내려받기 기록을 남긴다 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: seg } = await supabase
    .from("member_segments")
    .select("id, name, filters")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!seg) return NextResponse.json({ error: "명단을 찾을 수 없습니다." }, { status: 404 });

  const ids = await segmentMemberIds(supabase, tenant.id, parseSegmentFilter(seg.filters));
  const rows = await loadSegmentMembers(supabase, tenant.id, ids, 10_000);
  const csv = toCsv(
    ["후원자번호", "이름", "휴대폰", "이메일", "등급", "구분", "알게 된 경로"],
    rows.map((m) => [
      m.member_code ?? "",
      safeCsvText(m.name),
      m.phone ?? "",
      safeCsvText(m.email),
      m.tier ? (TIER_LABEL as Record<string, string>)[m.tier] ?? m.tier : "",
      m.member_type === "corporate" ? "기업·단체" : "개인",
      safeCsvText(m.join_path),
    ]),
  );

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.data_export",
    resourceType: "members",
    resourceId: seg.id,
    summary: `후원자 명단 '${seg.name}' 내려받기 (${rows.length}명)`,
    metadata: { segmentId: seg.id, count: rows.length },
  }).catch(() => {});

  const filename = encodeURIComponent(`${seg.name}_${kstToday()}.csv`);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="segment.csv"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
