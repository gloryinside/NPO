/**
 * 랜딩 편집기 미리보기 프레임 — 편집기(같은 출처 부모 창)가 postMessage로 보낸
 * 편집 중 섹션을 그대로 그린다. 관리자 전용, 관리자 사이드바 없이 공개 화면 모양으로.
 * 캠페인 목록·기관 테마는 공개 페이지와 같은 데이터를 서버에서 한 번 읽어 넘긴다.
 */
import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/auth";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ThemeConfigSchema,
  defaultThemeConfig,
  themeConfigToCss,
} from "@/lib/theme/config";
import { FrameClient, type FrameCampaign } from "./FrameClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LandingFramePage() {
  await requireAdminUser();
  const tenant = await getTenant();
  if (!tenant) return <p className="p-6 text-sm">기관 정보를 찾을 수 없습니다.</p>;

  const supabase = createSupabaseAdminClient();
  const [{ data: org }, { data: campaigns }, { data: paid }] = await Promise.all([
    supabase.from("orgs").select("theme_config").eq("id", tenant.id).single(),
    supabase
      .from("campaigns")
      .select("id, title, slug, description, goal_amount, ended_at, thumbnail_url")
      .eq("org_id", tenant.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),
    supabase
      .from("payments")
      .select("amount, campaign_id")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid"),
  ]);

  const raised = new Map<string, number>();
  for (const p of paid ?? []) {
    if (p.campaign_id) raised.set(p.campaign_id, (raised.get(p.campaign_id) ?? 0) + Number(p.amount ?? 0));
  }
  const rows: FrameCampaign[] = (campaigns ?? []).map((c) => ({ ...c, raised: raised.get(c.id) ?? 0 }));

  const parsed = ThemeConfigSchema.safeParse(org?.theme_config ?? {});
  const css = themeConfigToCss(parsed.success ? parsed.data : defaultThemeConfig());

  return (
    <>
      {/* 서버에서 zod로 검증한 설정으로 만든 CSS — 사용자 원문이 아님(공개 레이아웃과 동일) */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <FrameClient campaigns={rows} orgName={tenant.name} />
    </>
  );
}
