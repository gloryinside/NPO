"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * G-D06 / G-D29: 실패·미납 결제 재시도 버튼 + 쿨다운 카운트다운
 *
 * - 429 응답에 `retryAfterMs` 가 포함되면 남은 시간 표시 + 버튼 비활성
 * - ok:true&success:true → 성공 alert + 페이지 새로고침
 * - ok:true&success:false → Toss가 실패 응답. 사유 포함 alert
 */
export function PaymentRetryButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // 쿨다운 진행 중일 때만 1초 타이머
  useEffect(() => {
    if (cooldownUntil == null) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const remainingSec = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    : 0;
  const onCooldown = remainingSec > 0;

  async function handleClick() {
    if (busy || onCooldown) return;
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
        retryAfterMs?: number;
      };
      if (res.status === 429 && typeof data.retryAfterMs === "number") {
        setCooldownUntil(Date.now() + data.retryAfterMs);
        alert(
          data.error ??
            "재시도 횟수 제한에 도달했습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }
      if (!res.ok) {
        alert(data.error ?? "재시도에 실패했습니다.");
        return;
      }
      if (data.success) {
        alert("결제가 성공적으로 재처리되었습니다.");
      } else {
        alert(
          `재시도가 실패했습니다: ${data.message ?? "결제 승인이 거절되었습니다."}\n\n카드 변경 후 다시 시도해주세요.`
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || onCooldown}
      title={
        onCooldown
          ? `${remainingSec}초 뒤 재시도 가능`
          : "이 결제를 다시 시도"
      }
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: "var(--warning-soft)",
        color: "var(--warning)",
        border: "1px solid var(--warning)",
      }}
    >
      {busy ? "처리 중…" : onCooldown ? `${remainingSec}s 후 재시도` : "재시도"}
    </button>
  );
}
