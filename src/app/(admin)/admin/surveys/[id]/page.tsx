import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";

export const metadata = { title: "설문 응답" };

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [surveyRes, responsesRes] = await Promise.all([
    supabase.from("surveys").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("survey_responses")
      .select("id, score, nps_category, comment, responded_at, members(name, email)")
      .eq("org_id", tenant.id).eq("survey_id", id)
      .order("responded_at", { ascending: false }),
  ]);

  const survey = surveyRes.data;
  if (!survey) return notFound();

  type Resp = {
    id: string; score: number | null; nps_category: string | null;
    comment: string | null; responded_at: string;
    members: { name: string | null; email: string | null } | null;
  };
  const responses = (responsesRes.data as unknown as Resp[]) ?? [];

  const counts = { promoter: 0, passive: 0, detractor: 0 };
  for (const r of responses) {
    if (r.nps_category && r.nps_category in counts) {
      (counts as Record<string, number>)[r.nps_category]++;
    }
  }
  const npsScore = responses.length > 0
    ? Math.round(((counts.promoter - counts.detractor) / responses.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={survey.title}
        description={`${survey.survey_type} · ${survey.status}`}
        stats={
          survey.survey_type === "nps" ? (
            <>
              <StatCard label="응답 수" value={`${responses.length}건`} />
              <StatCard label="NPS" value={`${npsScore}`} tone={npsScore >= 0 ? "default" : "negative"} />
              <StatCard label="추천" value={`${counts.promoter}명`} />
              <StatCard label="비추천" value={`${counts.detractor}명`} tone={counts.detractor > 0 ? "warning" : "default"} />
            </>
          ) : (
            <StatCard label="응답 수" value={`${responses.length}건`} />
          )
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">응답 내역</h2>
        {responses.length === 0 ? (
          <p className="rounded-2xl border py-8 text-center text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
            아직 응답이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {responses.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: "var(--text)" }}>
                    {r.members?.name ?? "(이름 없음)"}
                    {r.score != null && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: r.nps_category === "promoter" ? "var(--positive-soft)"
                            : r.nps_category === "detractor" ? "var(--negative-soft)"
                            : "var(--surface-2)",
                          color: r.nps_category === "promoter" ? "var(--positive)"
                            : r.nps_category === "detractor" ? "var(--negative)"
                            : "var(--muted-foreground)",
                        }}>
                        {r.score}점
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {new Date(r.responded_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
