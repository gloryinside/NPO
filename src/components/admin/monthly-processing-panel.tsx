"use client";

type MethodStats = {
  done: number;
  pending: number;
  failed: number;
  total: number;
};

type DayStats = { day: number; count: number };

type Props = {
  month: string; // "YYYY-MM"
  cms: MethodStats;
  card: MethodStats;
  byDay: DayStats[];
};

export function MonthlyProcessingPanel({ month, cms, card, byDay }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">
        당월처리현황 ({month})
      </h2>

      {/* CMS / CARD 집계 테이블 */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface-2)] text-[var(--muted-foreground)]">
              <th className="px-4 py-2 text-left text-xs font-medium">구분</th>
              <th className="px-4 py-2 text-right text-xs font-medium">CMS</th>
              <th className="px-4 py-2 text-right text-xs font-medium">카드</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: "done", label: "처리완료" },
              { key: "pending", label: "미처리" },
              { key: "failed", label: "실패" },
              { key: "total", label: "합계금액" },
            ].map(({ key, label }) => (
              <tr key={key} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{label}</td>
                <td className="px-4 py-3 text-right font-medium text-[var(--text)]">
                  {key === "total"
                    ? `₩${cms.total.toLocaleString("ko-KR")}`
                    : `${(cms[key as keyof MethodStats] as number).toLocaleString("ko-KR")}건`}
                </td>
                <td className="px-4 py-3 text-right font-medium text-[var(--text)]">
                  {key === "total"
                    ? `₩${card.total.toLocaleString("ko-KR")}`
                    : `${(card[key as keyof MethodStats] as number).toLocaleString("ko-KR")}건`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 출금일별 건수 */}
      {byDay.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-[var(--muted-foreground)]">처리일정</h3>
          <div className="flex flex-wrap gap-3">
            {byDay.map(({ day, count }) => (
              <div
                key={day}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center"
              >
                <div className="text-xs text-[var(--muted-foreground)]">{day}일 출금</div>
                <div className="mt-1 text-lg font-bold text-[var(--text)]">
                  {count.toLocaleString("ko-KR")}건
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
