"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [issuing, setIssuing] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<"idle" | "confirm" | "running">("idle");
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
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
        setNotice({ type: "error", text: `발급 실패: ${(data as { error?: string }).error ?? res.statusText}` });
      }
    } finally {
      setIssuing((prev) => {
        const s = new Set(prev);
        s.delete(memberId);
        return s;
      });
    }
  }

  // 서버 데이터(rows, router.refresh 후 갱신)와 이 화면에서 방금 발급한 것(issued)을 합쳐 본다
  const issuedInfoOf = (r: ReceiptRow) =>
    issued.get(r.memberId) ??
    (r.receiptIssued && r.receiptCode ? { code: r.receiptCode, pdfUrl: r.receiptPdfUrl } : undefined);
  const pending = rows.filter((r) => !issuedInfoOf(r) && r.idNumberSet);

  // 서버에서 발급만 한다(PDF를 브라우저로 받지 않음). 200명씩 나눠 보내고, 기관 정보 누락이면 즉시 중단.
  async function issueAll() {
    setBulkState("running");
    setNotice(null);
    const total = { issued: 0, skipped: 0, failed: 0 };
    try {
      for (let i = 0; i < pending.length; i += 200) {
        const res = await fetch("/api/admin/receipts/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, memberIds: pending.slice(i, i + 200).map((r) => r.memberId) }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          issued?: number; skipped?: number; failed?: number; error?: string; blocked?: string[];
        };
        total.issued += data.issued ?? 0;
        total.skipped += data.skipped ?? 0;
        total.failed += data.failed ?? 0;
        if (!res.ok) {
          const reasons = data.blocked?.length ? ` (${data.blocked.join(" · ")})` : "";
          setNotice({ type: "error", text: `${data.error ?? "일괄 발급 실패"}${reasons}` });
          return;
        }
      }
      setNotice({
        type: total.failed ? "error" : "ok",
        text: `발급 ${total.issued}건 · 이미 발급/대상 아님 ${total.skipped}건${total.failed ? ` · 실패 ${total.failed}건(서버 로그 확인)` : ""}`,
      });
    } finally {
      setBulkState("idle");
      router.refresh();
    }
  }




  return (
    <div>
      {/* 액션 버튼 */}
      <div className="flex gap-3 mb-6">
        {bulkState === "confirm" ? (
          <>
            <Button onClick={issueAll} className="bg-[var(--accent)] text-white">
              {pending.length}명에게 발급
            </Button>
            <Button
              onClick={() => setBulkState("idle")}
              className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              취소
            </Button>
          </>
        ) : (
          <Button
            onClick={() => (pending.length ? setBulkState("confirm") : setNotice({ type: "error", text: "발급 가능한 미발급 대상이 없습니다(주민번호 미등록 후원자는 제외)." }))}
            disabled={bulkState === "running"}
            className="bg-[var(--accent)] text-white"
          >
            {bulkState === "running" ? "발급 중…" : "미발급 일괄 발급"}
          </Button>
        )}
        {/* 간소화 자료는 제외 대상·기관 기재사항을 먼저 확인하는 "간소화파일" 탭에서 내려받는다(XLSX) */}
        <a
          href={`/admin/receipts?tab=nts&year=${year}`}
          className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          국세청 간소화 자료 →
        </a>
      </div>

      {notice && (
        <p
          role={notice.type === "error" ? "alert" : "status"}
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            notice.type === "error"
              ? "border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)]"
              : "border-[var(--positive)] bg-[var(--positive-soft)] text-[var(--positive)]"
          }`}
        >
          {notice.text}
        </p>
      )}

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
                const issuedInfo = issuedInfoOf(r);
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
