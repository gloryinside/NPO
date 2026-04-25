import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";
import { JsonPostButton } from "@/components/admin/json-post-button";

export const metadata = { title: "회계 마감" };

type Row = {
  id: string; period_start: string; period_end: string;
  closed_at: string; reopened_at: string | null;
  reopen_reason: string | null; notes: string | null;
};

export default async function ClosedPeriodsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("closed_periods")
    .select("id, period_start, period_end, closed_at, reopened_at, reopen_reason, notes")
    .eq("org_id", tenant.id).order("period_end", { ascending: false });
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="회계 마감"
        description="기간을 마감하면 해당 기간의 payment 수정이 차단됩니다 (응용 단 검사)."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              마감된 기간이 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["기간", "마감일", "상태", "재오픈 사유", "액션"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        {r.period_start} ~ {r.period_end}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(r.closed_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-3 py-2.5 text-xs"
                        style={{ color: r.reopened_at ? "var(--warning)" : "var(--positive)" }}>
                        {r.reopened_at ? "재오픈됨" : "마감"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {r.reopen_reason ?? "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        {!r.reopened_at && (
                          <JsonPostButton
                            url={`/api/admin/closed-periods/${r.id}/reopen`}
                            body={{ reason: "수정 필요" }}
                            label="재오픈"
                            variant="default"
                            confirm="마감을 풀까요? 사유 5자 이상 필요."
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">기간 마감</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/closed-periods"
              fields={[
                { name: "periodStart", label: "시작일", type: "date", required: true },
                { name: "periodEnd", label: "종료일", type: "date", required: true },
                { name: "notes", label: "메모", type: "textarea", rows: 2 },
              ]}
              submitLabel="마감"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
