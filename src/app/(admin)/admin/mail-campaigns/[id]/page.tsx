import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ExportButton } from "./export-button";

export const metadata = { title: "DM 캠페인 상세" };

export default async function MailCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [campaignRes, dispatchRes, tagsRes] = await Promise.all([
    supabase.from("mail_campaigns").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("mail_dispatches").select("status")
      .eq("org_id", tenant.id).eq("campaign_id", id),
    supabase.from("member_tags").select("id, name").eq("org_id", tenant.id).order("name"),
  ]);

  const campaign = campaignRes.data;
  if (!campaign) return notFound();

  const dispatches = (dispatchRes.data ?? []) as Array<{ status: string }>;
  const stats = { pending: 0, sent: 0, returned: 0, undeliverable: 0 };
  for (const d of dispatches) {
    if (d.status in stats) (stats as Record<string, number>)[d.status]++;
  }

  const segmentFilter = campaign.segment_filter ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={`상태: ${campaign.status}`}
        stats={
          <>
            <StatCard label="총 수신자" value={`${campaign.recipient_count.toLocaleString("ko-KR")}명`} />
            <StatCard label="발송" value={`${stats.sent}건`} />
            <StatCard label="반송/배달불가" value={`${stats.returned + stats.undeliverable}건`}
              tone={stats.returned + stats.undeliverable > 0 ? "warning" : "default"} />
          </>
        }
      />

      <section className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">세그먼트 필터</h2>
        <pre className="rounded-md p-3 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text)", overflow: "auto" }}>
          {JSON.stringify(segmentFilter, null, 2)}
        </pre>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          필터 형식 예: {`{ "tier": ["gold","platinum"], "tagIds": [...], "minTotalPaid": 100000, "activeOnly": true }`}
          <br/>현재는 직접 DB UPDATE 또는 추후 UI 폼으로 편집할 수 있습니다.
          <br/>사용 가능 태그: {((tagsRes.data ?? []) as Array<{name: string}>).map(t => t.name).join(", ") || "(없음)"}
        </p>
      </section>

      <section className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">명단 추출</h2>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          현재 세그먼트 필터로 회원 명단을 추출하고 우체국 라벨용 CSV를 다운로드합니다.
          한 번 추출하면 mail_dispatches에 행이 기록되어 중복 발송이 방지됩니다.
        </p>
        <ExportButton campaignId={id} disabled={campaign.status !== "planning"} />
      </section>
    </div>
  );
}
