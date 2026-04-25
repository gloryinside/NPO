import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "설문/NPS" };

const TYPE_LABEL: Record<string, string> = {
  nps: "NPS (0~10)",
  csat: "CSAT (1~5)",
  custom: "사용자 정의",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "작성중", open: "공개", closed: "마감",
};

type Row = {
  id: string;
  title: string;
  survey_type: string;
  status: string;
  open_at: string;
  close_at: string | null;
};

export default async function SurveysPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("surveys")
    .select("id, title, survey_type, status, open_at, close_at")
    .eq("org_id", tenant.id)
    .order("open_at", { ascending: false });

  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="설문/NPS"
        description="후원자 만족도 조사. NPS 점수 기반 자동 분류 (0-6 detractor / 7-8 passive / 9-10 promoter)."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 설문이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["제목", "유형", "상태", "공개일", "마감일"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/surveys/${s.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>{s.title}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[s.survey_type]}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[s.status]}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(s.open_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {s.close_at ? new Date(s.close_at).toLocaleDateString("ko-KR") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 설문</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/surveys"
              fields={[
                { name: "title", label: "제목", required: true },
                { name: "description", label: "설명", type: "textarea" },
                {
                  name: "surveyType", label: "유형", type: "select",
                  defaultValue: "nps",
                  options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "openAt", label: "공개일", type: "datetime-local" },
                { name: "closeAt", label: "마감일", type: "datetime-local" },
                {
                  name: "status", label: "상태", type: "select",
                  defaultValue: "draft",
                  options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
              ]}
              submitLabel="설문 생성"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
