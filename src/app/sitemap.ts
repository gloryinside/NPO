import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D85: 동적 sitemap — 공개 랜딩 + 활성 캠페인 목록.
 *
 * 호스트당 별도 sitemap (multi-tenant 서브도메인) — 현재 요청 호스트의 tenant 만 포함.
 */
export const revalidate = 3600; // 1시간 캐시

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return [];

  const base = `${proto}://${host}`;
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
  ];

  // tenant 기반 캠페인 — 호스트에서 tenant 추출 (미들웨어 미경유라 직접 조회)
  try {
    const supabase = createSupabaseAdminClient();
    // 간이: host 전체 문자열로 orgs 매치는 별도 매핑 필요 — 여기선 전체 활성 캠페인 (단일 배포 가정)
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("slug, updated_at, ended_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1000);

    for (const c of (campaigns ?? []) as Array<{
      slug: string;
      updated_at: string | null;
      ended_at: string | null;
    }>) {
      // 종료된 캠페인도 SEO 목적으로 포함 (아카이브 가치)
      entries.push({
        url: `${base}/campaigns/${c.slug}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : now,
        changeFrequency: c.ended_at ? "yearly" : "weekly",
        priority: c.ended_at ? 0.3 : 0.7,
      });
    }
  } catch {
    // DB 실패 시 최소 entry 만 반환
  }

  return entries;
}
