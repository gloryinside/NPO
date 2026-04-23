import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calcLtv, calcCohorts } from "@/lib/stats/ltv-cac";

export const metadata = { title: "LTV / 코호트" };

function formatKRW(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * G-D144: LTV 요약 + 가입월 기준 retention (1/3/6/12개월).
 */
export default async function AdminLtvPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [ltv, cohorts] = await Promise.all([
    calcLtv(supabase, tenant.id),
    calcCohorts(supabase, tenant.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">LTV & 코호트</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          후원자 라이프타임 밸류 요약과 가입월별 유지율 (paid 결제 기준).
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="전체 후원자 수" value={`${ltv.totalDonors}명`} />
        <Card label="신규 (24개월)" value={`${ltv.newDonorsInWindow}명`} />
        <Card label="LTV 평균" value={formatKRW(ltv.ltvAverage)} accent />
        <Card label="LTV 중앙값" value={formatKRW(ltv.ltvMedian)} />
        <Card
          label="첫 후원 중앙값"
          value={formatKRW(ltv.firstDonationMedian)}
        />
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          가입월별 유지율
        </h2>
        {cohorts.length === 0 ? (
          <div
            className="rounded-2xl border py-12 text-center text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--muted-foreground)",
            }}
          >
            12개월 이내 가입자가 없어 코호트를 생성할 수 없습니다.
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <table className="w-full">
              <thead
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <tr>
                  {["가입월", "인원", "+1m", "+3m", "+6m", "+12m"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr
                    key={c.cohort}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td
                      className="px-4 py-3 font-mono text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      {c.cohort}
                    </td>
                    <td
                      className="px-4 py-3 text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {c.size}
                    </td>
                    {["1m", "3m", "6m", "12m"].map((b) => {
                      const v = c.retention[b] ?? 0;
                      return (
                        <td
                          key={b}
                          className="px-4 py-3 text-sm font-semibold"
                          style={{
                            color:
                              v >= 0.5
                                ? "var(--positive)"
                                : v >= 0.2
                                  ? "var(--warning)"
                                  : "var(--muted-foreground)",
                          }}
                        >
                          {formatPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className="mt-1 text-xl font-bold"
        style={{ color: accent ? "var(--accent)" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}
