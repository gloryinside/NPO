import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Campaign } from "@/types/campaign";

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
        <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
          캠페인을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const formattedGoal = campaign.goal_amount
    ? new Intl.NumberFormat("ko-KR").format(campaign.goal_amount) + "원"
    : null;

  const dateRange =
    campaign.started_at && campaign.ended_at
      ? `${campaign.started_at} ~ ${campaign.ended_at}`
      : campaign.started_at
        ? `${campaign.started_at} ~`
        : null;

  const safeDescription = sanitizeHtml(campaign.description ?? "");

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-start gap-4 mb-4">
        <h1
          className="text-3xl font-bold flex-1"
          style={{ color: "var(--text)" }}
        >
          {campaign.title}
        </h1>
        <span
          className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
          style={{
            background:
              campaign.status === "active"
                ? "rgba(34,197,94,0.15)"
                : "rgba(136,136,170,0.15)",
            color:
              campaign.status === "active"
                ? "var(--positive)"
                : "var(--muted-foreground)",
          }}
        >
          {campaign.status === "active" ? "진행중" : "종료"}
        </span>
      </div>

      <div
        className="flex flex-col gap-2 mb-8 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        {formattedGoal && (
          <p>
            <span className="font-medium">목표금액:</span>{" "}
            <span style={{ color: "var(--text)" }}>{formattedGoal}</span>
          </p>
        )}
        {dateRange && (
          <p>
            <span className="font-medium">기간:</span>{" "}
            <span style={{ color: "var(--text)" }}>{dateRange}</span>
          </p>
        )}
      </div>

      {campaign.description && (
        <div
          className="prose prose-invert max-w-none mb-10"
          style={{ color: "var(--text)" }}
          // Content is sanitized via DOMPurify (sanitizeHtml) before render
          dangerouslySetInnerHTML={{ __html: safeDescription }}
        />
      )}

      <a
        href="#donate"
        className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
        style={{
          background: "var(--accent)",
          color: "#ffffff",
        }}
      >
        후원하기
      </a>
    </div>
  );
}
