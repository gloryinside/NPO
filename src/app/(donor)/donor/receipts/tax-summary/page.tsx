import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstCurrentYear } from "@/lib/donor/kst-time";
import { EmptyState } from "@/components/donor/ui/EmptyState";
import { PrintButtonClient } from "@/components/donor/ui/PrintButtonClient";
import { TaxYearSelect } from "@/components/donor/ui/TaxYearSelect";

export const metadata = { title: "연말정산 요약" };

type ReceiptRow = {
  id: string;
  receipt_code: string;
  year: number;
  total_amount: number;
  issued_at: string | null;
  pdf_url: string | null;
};

function formatAmount(v: number) {
  return `${new Intl.NumberFormat("ko-KR").format(v)}원`;
}
function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

/**
 * G-D52: 연말정산(기부금공제) 제출용 요약 페이지.
 * - 기본: 올해(KST) 발급 영수증만 표시
 * - ?year=YYYY 쿼리로 과거년도 전환
 * - 인쇄 버튼 + ZIP 일괄 다운로드
 */
export default async function DonorTaxSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { member } = await requireDonorSession();
  const supabase = createSupabaseAdminClient();

  const sp = await searchParams;
  const defaultYear = kstCurrentYear();
  const year = Number(sp.year) >= 2000 ? Number(sp.year) : defaultYear;

  const { data } = await supabase
    .from("receipts")
    .select("id, receipt_code, year, total_amount, issued_at, pdf_url")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("year", year)
    .order("issued_at", { ascending: true });

  const rows = (data as unknown as ReceiptRow[]) ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  const { data: allYearsData } = await supabase
    .from("receipts")
    .select("year")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id);
  const years = Array.from(
    new Set((allYearsData ?? []).map((r: { year: number }) => r.year))
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-print-hide="true"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">연말정산 요약</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            기부금 공제 제출용으로 인쇄하거나 PDF 일괄 다운로드하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {years.length > 1 && <TaxYearSelect years={years} value={year} />}
          {rows.length > 0 && (
            <>
              <a
                href={`/api/donor/receipts/export?year=${year}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: "var(--accent)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                📦 PDF 일괄 다운로드
              </a>
              <PrintButtonClient />
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="📋"
          title={`${year}년 영수증이 없습니다.`}
          description="발급된 영수증은 연말 기준으로 표시됩니다."
        />
      ) : (
        <>
          {/* 인쇄용 헤더 (화면엔 감춤) */}
          <div className="hidden print:block">
            <h2 className="text-xl font-bold">{year}년 기부금 영수증 요약</h2>
            <p className="text-sm">
              후원자: {member.name} ({member.member_code})
            </p>
            <p className="text-xs">
              출력일: {new Date().toLocaleDateString("ko-KR")}
            </p>
          </div>

          <section>
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <table className="w-full">
                <thead
                  style={{
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      영수증 번호
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      발급일
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      금액
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:hidden"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      PDF
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td
                        className="px-4 py-3 text-sm font-mono"
                        style={{ color: "var(--text)" }}
                      >
                        {r.receipt_code}
                      </td>
                      <td
                        className="px-4 py-3 text-sm"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {formatDate(r.issued_at)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        {formatAmount(r.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm print:hidden">
                        {r.pdf_url ? (
                          <a
                            href={`/api/donor/receipts/${r.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent)" }}
                          >
                            보기
                          </a>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            준비 중
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot
                  style={{
                    background: "var(--surface-2)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-sm font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      총 {rows.length}건 합계
                    </td>
                    <td
                      className="px-4 py-3 text-right text-base font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {formatAmount(total)}
                    </td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p
              className="mt-3 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              ※ 국세청 연말정산 간소화 서비스에도 같은 금액이 등록됩니다.
              중복 제출에 주의하세요.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
