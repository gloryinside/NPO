import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/donor/ui/EmptyState";

type ReceiptRow = {
  id: string;
  receipt_code: string;
  year: number;
  total_amount: number;
  pdf_url: string | null;
  issued_at: string | null;
};

function formatAmount(value: number | null | undefined) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

export default async function DonorReceiptsPage() {
  const { member } = await requireDonorSession();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("receipts")
    .select("id, receipt_code, year, total_amount, pdf_url, issued_at")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("year", { ascending: false });

  const receipts = (data as unknown as ReceiptRow[]) ?? [];

  // 연도별 그룹 + 집계 (일괄 다운로드에 사용)
  const yearGroups = new Map<number, { total: number; downloadable: number }>();
  for (const r of receipts) {
    const g = yearGroups.get(r.year) ?? { total: 0, downloadable: 0 };
    g.total += 1;
    if (r.pdf_url) g.downloadable += 1;
    yearGroups.set(r.year, g);
  }
  const years = Array.from(yearGroups.entries()).sort((a, b) => b[0] - a[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">기부금 영수증</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          발급된 기부금 영수증을 확인하고 다운로드하세요.
        </p>
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="발급된 영수증이 없습니다."
          description="후원 내역에 기반해 연말 기준으로 발급됩니다."
        />
      ) : (
        <>
          {/* 연도별 일괄 다운로드 */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
              연도별 일괄 다운로드
            </h2>
            <div className="flex flex-wrap gap-2">
              {years.map(([year, g]) => {
                const disabled = g.downloadable === 0;
                const title = disabled
                  ? `${year}년 영수증은 아직 PDF가 생성되지 않았습니다.`
                  : `${g.downloadable}건의 PDF를 ZIP으로 다운로드`;
                return disabled ? (
                  <span
                    key={year}
                    title={title}
                    {...{ "aria-disabled": "true" as const }}
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium opacity-50"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    📦 {year}년 ZIP (PDF 준비 중 · {g.total}건)
                  </span>
                ) : (
                  <a
                    key={year}
                    href={`/api/donor/receipts/export?year=${year}`}
                    title={title}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      borderColor: "var(--accent)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    📦 {year}년 전체 ZIP ({g.downloadable}/{g.total}건)
                  </a>
                );
              })}
            </div>
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              PDF가 생성된 영수증만 포함되며, 제외 내역은 ZIP 내 README.txt
              에서 확인할 수 있습니다.
            </p>
          </section>

          {/* 개별 영수증 목록 */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
              개별 영수증
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <ul>
                {receipts.map((r, idx) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-4 ${
                      idx > 0 ? "border-t border-[var(--border)]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {r.year}년 기부금 영수증
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono">{r.receipt_code}</span>
                        <span>발급: {formatDate(r.issued_at)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {formatAmount(r.total_amount)}
                      </span>
                      {r.pdf_url ? (
                        <a
                          href={`/api/donor/receipts/${r.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] border-[var(--accent)] text-[var(--accent)]"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center text-xs text-[var(--muted-foreground)]">
                          준비 중
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
