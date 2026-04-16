"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ReceiptRow = {
  memberId: string;
  memberName: string;
  idNumberSet: boolean;
  payCount: number;
  totalAmount: number;
  receiptIssued: boolean;
  receiptCode: string | null;
  receiptPdfUrl: string | null;
  issuedAt: string | null;
};

function formatKRW(v: number) {
  return `${new Intl.NumberFormat("ko-KR").format(v)}원`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

export function ReceiptBulkActions({
  year,
  rows,
}: {
  year: number;
  rows: ReceiptRow[];
}) {
  const [issuing, setIssuing] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<Map<string, { code: string; pdfUrl: string | null }>>(
    () => {
      const m = new Map<string, { code: string; pdfUrl: string | null }>();
      for (const r of rows) {
        if (r.receiptIssued && r.receiptCode) {
          m.set(r.memberId, { code: r.receiptCode, pdfUrl: r.receiptPdfUrl });
        }
      }
      return m;
    }
  );
  const [ntsLoading, setNtsLoading] = useState(false);

  async function issueOne(memberId: string) {
    setIssuing((prev) => new Set(prev).add(memberId));
    try {
      const res = await fetch(`/api/admin/receipts/${memberId}?year=${year}`);
      if (res.ok) {
        // 파일 다운로드
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `receipt-${memberId}-${year}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        // 화면 갱신 (낙관적 업데이트: issued로 표시)
        const code = res.headers.get("Content-Disposition")?.match(/receipt-([^.]+)\.pdf/)?.[1] ?? "";
        setIssued((prev) => {
          const m = new Map(prev);
          m.set(memberId, { code, pdfUrl: null });
          return m;
        });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`발급 실패: ${(data as { error?: string }).error ?? res.statusText}`);
      }
    } finally {
      setIssuing((prev) => {
        const s = new Set(prev);
        s.delete(memberId);
        return s;
      });
    }
  }

  async function issueAll() {
    const pending = rows.filter(
      (r) => !issued.has(r.memberId) && r.idNumberSet
    );
    if (pending.length === 0) {
      alert("발급 가능한 미발급 대상이 없습니다.");
      return;
    }
    if (!confirm(`${pending.length}명에게 일괄 발급하시겠습니까?\n(주민번호 미등록 후원자는 제외됩니다)`)) return;

    for (const r of pending) {
      await issueOne(r.memberId);
    }
  }

  async function downloadNts() {
    setNtsLoading(true);
    try {
      const res = await fetch(`/api/admin/receipts/nts-export?year=${year}`);
      if (res.ok) {
        const text = await res.text();
        const count = res.headers.get("X-NTS-Count") ?? "?";
        const total = res.headers.get("X-NTS-Total") ?? "?";
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.headers.get("Content-Disposition")?.split('filename="')[1]?.replace('"', "") ?? `nts_donation_${year}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        alert(`국세청 간소화 자료 생성 완료\n건수: ${count}건 / 합계: ${Number(total).toLocaleString("ko-KR")}원`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`파일 생성 실패: ${(data as { error?: string }).error ?? res.statusText}`);
      }
    } finally {
      setNtsLoading(false);
    }
  }

  return (
    <div>
      {/* 액션 버튼 */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={issueAll}
          className="bg-[var(--accent)] text-white"
        >
          미발급 일괄 발급
        </Button>
        <Button
          onClick={downloadNts}
          disabled={ntsLoading}
          className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          {ntsLoading ? "생성 중..." : "국세청 간소화 자료 다운로드"}
        </Button>
      </div>

      {/* 목록 테이블 */}
      {rows.length === 0 ? (
        <div
          className="rounded-lg border p-10 text-center text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {year}년 납입 내역이 없습니다.
        </div>
      ) : (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>후원자</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>납입 건수</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>기부금액</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>주민번호</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>발급상태</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>발급일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const issuedInfo = issued.get(r.memberId);
                const isIssuedNow = !!issuedInfo;
                const isIssuingNow = issuing.has(r.memberId);

                return (
                  <tr
                    key={r.memberId}
                    style={{
                      borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                      background: "var(--surface)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text)" }}>
                        {r.memberName}
                      </div>
                      {isIssuedNow && issuedInfo.code && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          {issuedInfo.code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text)" }}>
                      {r.payCount}건
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                      {formatKRW(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.idNumberSet ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(34,197,94,0.12)", color: "var(--positive)" }}
                        >
                          등록
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(239,68,68,0.10)", color: "var(--negative)" }}
                        >
                          미등록
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isIssuedNow ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(34,197,94,0.12)", color: "var(--positive)" }}
                        >
                          발급완료
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(156,163,175,0.15)", color: "var(--muted-foreground)" }}
                        >
                          미발급
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {isIssuedNow ? formatDateTime(r.issuedAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isIssuedNow && issuedInfo.pdfUrl && (
                          <a
                            href={issuedInfo.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded border"
                            style={{
                              borderColor: "var(--accent)",
                              color: "var(--accent)",
                              textDecoration: "none",
                            }}
                          >
                            PDF
                          </a>
                        )}
                        <button
                          onClick={() => issueOne(r.memberId)}
                          disabled={isIssuingNow || !r.idNumberSet}
                          className="text-xs px-3 py-1 rounded border transition-colors disabled:opacity-40"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--surface-2)",
                            color: "var(--text)",
                            cursor: r.idNumberSet ? "pointer" : "not-allowed",
                          }}
                        >
                          {isIssuingNow ? "발급 중..." : isIssuedNow ? "재발급" : "발급"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
