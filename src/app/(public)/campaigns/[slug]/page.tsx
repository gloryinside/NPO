import Link from "next/link";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Campaign } from "@/types/campaign";
import { BlockRenderer } from "@/components/campaign-blocks/BlockRenderer";
import { PageContentSchema } from "@/lib/campaign-builder/blocks/schema";
import { CheerWall } from "@/components/cheer/CheerWall";

export const revalidate = 60;

export default async function CampaignPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await getTenant();
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
          잘못된 접근입니다.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("slug", slug)
    .eq("status", "active")
    .single<Campaign>();

  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-lg text-[var(--muted-foreground)]">
          캠페인을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  // If the campaign has published builder content, render via BlockRenderer.
  const parsedContent = PageContentSchema.safeParse(campaign.published_content);
  if (parsedContent.success && parsedContent.data.blocks.length > 0) {
    return (
      <main>
        <BlockRenderer content={parsedContent.data} slug={slug} />
        <div className="mx-auto max-w-3xl px-4 pb-12">
          <CheerWall campaignId={campaign.id} />
        </div>
      </main>
    );
  }

  // Legacy fallback: description-based layout for campaigns without builder content.
  // 이 캠페인의 실제 누적 납입액 집계
  const { data: paidRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", tenant.id)
    .eq("campaign_id", campaign.id)
    .eq("pay_status", "paid");

  const raisedAmount = (paidRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const goalAmount = campaign.goal_amount ?? 0;
  const progressPct =
    goalAmount > 0 ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100) : null;

  const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
  const formattedGoal = goalAmount ? fmt(goalAmount) + "원" : null;
  const formattedRaised = fmt(raisedAmount) + "원";

  const dateRange =
    campaign.started_at && campaign.ended_at
      ? `${campaign.started_at} ~ ${campaign.ended_at}`
      : campaign.started_at
        ? `${campaign.started_at} ~`
        : null;

  const safeDescription = sanitizeHtml(campaign.description ?? "");

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {campaign.thumbnail_url && (
        <div className="mb-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaign.thumbnail_url}
            alt={campaign.title}
            className="w-full object-cover max-h-72"
          />
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <h1 className="text-3xl font-bold flex-1 text-[var(--text)]">
          {campaign.title}
        </h1>
        <span
          className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            campaign.status === "active"
              ? "bg-[var(--positive-soft)] text-[var(--positive)]"
              : "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]"
          }`}
        >
          {campaign.status === "active" ? "진행중" : "종료"}
        </span>
      </div>

      {/* 달성률 progress bar */}
      {goalAmount > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-[var(--text)]">{formattedRaised} 모금</span>
            <span className="text-[var(--muted-foreground)]">목표 {formattedGoal}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progressPct ?? 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-right text-[var(--muted-foreground)]">
            {progressPct !== null ? `${progressPct}% 달성` : ""}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-8 text-sm text-[var(--muted-foreground)]">
        {!goalAmount && raisedAmount > 0 && (
          <p>
            <span className="font-medium">누적 모금액:</span>{" "}
            <span className="text-[var(--text)]">{formattedRaised}</span>
          </p>
        )}
        {dateRange && (
          <p>
            <span className="font-medium">기간:</span>{" "}
            <span className="text-[var(--text)]">{dateRange}</span>
          </p>
        )}
      </div>

      {campaign.description && (
        <div
          className="prose prose-invert max-w-none mb-10 text-[var(--text)]"
          // Content is sanitized via DOMPurify (sanitizeHtml) before render
          dangerouslySetInnerHTML={{ __html: safeDescription }}
        />
      )}

      <Link
        href={`/campaigns/${campaign.slug}/donate`}
        className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90 bg-[var(--accent)] text-white"
      >
        후원하기
      </Link>

      <CheerWall campaignId={campaign.id} />
    </div>
  );
}
