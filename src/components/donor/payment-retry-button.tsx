"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * G-D06: 실패/미납 결제 재시도 버튼
 *
 * 클릭 → 서버에 재시도 요청 → 성공 시 페이지 새로고침
 * - 응답은 2종류: ok:true&success:true (성공), ok:true&success:false (Toss가 실패 반환)
 * - 4xx/5xx는 error 메시지로 alert
 */
export function PaymentRetryButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    if (!confirm("이 결제를 다시 시도하시겠습니까?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/donor/payments/${paymentId}/retry`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        alert(data.error ?? "재시도에 실패했습니다.");
        return;
      }
      if (data.success) {
        alert("결제가 성공적으로 재처리되었습니다.");
        router.refresh();
      } else {
        alert(
          `재시도가 실패했습니다: ${data.message ?? "결제 승인이 거절되었습니다."}\n\n카드 변경 후 다시 시도해주세요.`
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: "var(--warning-soft)",
        color: "var(--warning)",
        border: "1px solid var(--warning)",
      }}
    >
      {busy ? "처리 중…" : "재시도"}
    </button>
  );
}
