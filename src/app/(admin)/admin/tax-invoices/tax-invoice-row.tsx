"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  row: {
    id: string;
    business_reg_no: string;
    corp_legal_name: string;
    ceo_name: string | null;
    tax_invoice_email: string | null;
    amount: number;
    invoice_no: string | null;
    issue_date: string | null;
    status: string;
    external_provider: string | null;
    members: { name: string | null } | null;
  };
}

function formatBRN(s: string): string {
  if (s.length !== 10) return s;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
}

export function TaxInvoiceRow({ row }: Props) {
  const router = useRouter();
  const [invoiceNo, setInvoiceNo] = useState(row.invoice_no ?? "");
  const [issueDate, setIssueDate] = useState(
    row.issue_date ?? new Date().toISOString().slice(0, 10),
  );
  const [externalProvider, setExternalProvider] = useState(row.external_provider ?? "manual");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(status: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/tax-invoices/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          invoiceNo: status === "issued" ? invoiceNo : undefined,
          issueDate: status === "issued" ? issueDate : undefined,
          externalProvider: status === "issued" ? externalProvider : undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            {row.corp_legal_name}
            {row.ceo_name && <span className="ml-2 text-xs text-[var(--muted-foreground)]">대표 {row.ceo_name}</span>}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {formatBRN(row.business_reg_no)} · {row.tax_invoice_email ?? "이메일 미설정"}
            {row.members?.name && ` · 회원: ${row.members.name}`}
          </p>
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">
          {Number(row.amount).toLocaleString("ko-KR")}원
        </span>
      </div>

      {row.status === "pending" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="발행 번호"
            className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
            className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
          <select value={externalProvider} onChange={(e) => setExternalProvider(e.target.value)}
            className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            <option value="manual">수동</option>
            <option value="popbill">팝빌</option>
            <option value="kakao">카카오 인증서</option>
          </select>
        </div>
      )}

      {row.status === "issued" && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          발행 {row.issue_date} · {row.external_provider ?? "manual"} · 번호 {row.invoice_no ?? "-"}
        </p>
      )}

      {(row.status === "pending" || row.status === "issued") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.status === "pending" && (
            <button type="button" onClick={() => patch("issued")} disabled={isPending || !invoiceNo}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              발행 완료
            </button>
          )}
          {row.status === "issued" && (
            <button type="button" onClick={() => patch("sent")} disabled={isPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: "var(--positive)" }}>
              전송 완료
            </button>
          )}
          <button type="button" onClick={() => patch("cancelled")} disabled={isPending}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--surface)" }}>
            취소
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
