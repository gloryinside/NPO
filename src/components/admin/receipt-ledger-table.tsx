import { formatKRW, formatDateKR } from "@/lib/format";

type LedgerRow = {
  memberId: string;
  memberName: string;
  receiptCode: string;
  totalAmount: number;
  issuedAt: string | null;
  pdfUrl: string | null;
};

type Props = {
  rows: LedgerRow[];
  year: number;
};

export function ReceiptLedgerTable({ rows, year }: Props) {
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          총 {rows.length}명 / {formatKRW(grandTotal)}
        </p>
        <a
          href={`/api/admin/receipts/ledger-csv?year=${year}`}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          CSV 다운로드
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              {["번호", "영수증번호", "회원명", "기부금액", "발급일시", "PDF"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  발급된 영수증이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.receiptCode}
                  className={idx > 0 ? "border-t border-[var(--border)]" : ""}
                >
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{row.receiptCode}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{row.memberName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--positive,#22c55e)]">
                    {formatKRW(row.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {row.issuedAt ? formatDateKR(row.issuedAt) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {row.pdfUrl ? (
                      <a
                        href={row.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--accent)] hover:underline"
                      >
                        PDF ↓
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
