import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">기부금 영수증</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          발급된 기부금 영수증을 확인하고 다운로드하세요.
        </p>
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-lg border p-8 text-center border-[var(--border)] bg-[var(--surface)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            발급된 영수증이 없습니다.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <ul>
            {receipts.map((r, idx) => (
              <li
                key={r.id}
                className={`flex items-center justify-between p-4 ${
                  idx > 0 ? "border-t border-[var(--border)]" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">
                    {r.year}년 기부금 영수증
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {r.receipt_code}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      발급일: {formatDate(r.issued_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {formatAmount(r.total_amount)}
                  </span>
                  {r.pdf_url ? (
                    <a
                      href={r.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] border-[var(--accent)] text-[var(--accent)]"
                    >
                      PDF 다운로드
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      PDF 준비 중
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
