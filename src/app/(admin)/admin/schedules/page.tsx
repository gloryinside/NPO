import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKRW } from "@/lib/format";
import type { PromiseWithRelations } from "@/types/promise";

export default async function SchedulesPage() {
  await requireAdminUser();

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  // 활성 정기 약정 전체 조회
  const { data, count } = await supabase
    .from("promises")
    .select("*, members(id, name, member_code, phone), campaigns(id, title)", { count: "exact" })
    .eq("org_id", tenant.id)
    .eq("type", "regular")
    .eq("status", "active")
    .order("pay_day", { ascending: true, nullsFirst: false });

  const promises = (data as unknown as PromiseWithRelations[]) ?? [];
  const total = count ?? 0;

  // pay_day 별 그룹
  const groups = new Map<number | null, PromiseWithRelations[]>();
  for (const p of promises) {
    const key = p.pay_day ?? null;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  // 일별 합계
  const totalMonthly = promises.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const dayKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  // 이번 달 남은 결제 예정일 강조
  const today = new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            정기 스케줄
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            활성 정기 약정의 월별 결제 일정입니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            총 {total.toLocaleString("ko-KR")}건
          </span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            월 예정 금액 {formatKRW(totalMonthly)}
          </span>
        </div>
      </div>

      {/* 날짜별 그리드 요약 (1~31일) */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          결제일 분포
        </h2>
        <div className="flex flex-wrap gap-2">
          {dayKeys.map((day) => {
            const items = groups.get(day) ?? [];
            const amt = items.reduce((s, p) => s + Number(p.amount ?? 0), 0);
            const isPast = day !== null && day < today;
            const isToday = day === today;
            const isUpcoming = day !== null && day > today;
            return (
              <a
                key={day ?? "none"}
                href={`#day-${day ?? "none"}`}
                className="rounded-lg border px-3 py-2 text-center min-w-[72px] transition-opacity hover:opacity-80"
                style={{
                  borderColor: isToday ? "var(--accent)" : "var(--border)",
                  background: isToday
                    ? "rgba(124,58,237,0.12)"
                    : isUpcoming
                      ? "var(--surface-2)"
                      : "var(--surface)",
                  textDecoration: "none",
                  opacity: isPast ? 0.55 : 1,
                }}
              >
                <div
                  className="text-sm font-bold"
                  style={{ color: isToday ? "var(--accent)" : "var(--text)" }}
                >
                  {day !== null ? `${day}일` : "미설정"}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {items.length}건
                </div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {formatKRW(amt)}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* 날짜별 약정 목록 */}
      <div className="space-y-4">
        {dayKeys.map((day) => {
          const items = groups.get(day) ?? [];
          const dayTotal = items.reduce((s, p) => s + Number(p.amount ?? 0), 0);
          const isToday = day === today;
          const isPast = day !== null && day < today;

          return (
            <div
              key={day ?? "none"}
              id={`day-${day ?? "none"}`}
              className="rounded-lg border overflow-hidden"
              style={{
                borderColor: isToday ? "var(--accent)" : "var(--border)",
                background: "var(--surface)",
                opacity: isPast ? 0.7 : 1,
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: isToday ? "rgba(124,58,237,0.08)" : "var(--surface-2)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isToday ? "var(--accent)" : "var(--text)" }}
                  >
                    {day !== null ? `매월 ${day}일` : "결제일 미설정"}
                  </span>
                  {isToday && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      오늘
                    </span>
                  )}
                  {isPast && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                    >
                      완료
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {items.length}건 · {formatKRW(dayTotal)}
                  </span>
                </div>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {items.map((p, idx) => (
                    <tr
                      key={p.id}
                      style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}
                    >
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/members/${p.member_id}`}
                          className="font-medium hover:underline"
                          style={{ color: "var(--text)" }}
                        >
                          {p.members?.name ?? "-"}
                        </a>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {p.members?.member_code ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                        {p.campaigns?.title ?? "일반 후원"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                        {p.pay_method ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                        {formatKRW(Number(p.amount ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/admin/promises?member=${p.member_id}`}
                          className="text-xs px-2 py-1 rounded border"
                          style={{
                            borderColor: "var(--border)",
                            color: "var(--muted-foreground)",
                            textDecoration: "none",
                          }}
                        >
                          약정 →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {promises.length === 0 && (
          <div
            className="rounded-lg border p-12 text-center text-sm"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            활성 정기 약정이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
