"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import type { Campaign } from "@/types/campaign";

const PRESET_AMOUNTS = [10000, 30000, 50000, 100000];

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

function formatAmount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function DonationForm({ campaign }: { campaign: Campaign }) {
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [amount, setAmount] = useState<number>(30000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handlePresetAmount(value: number) {
    setAmount(value);
    setCustomAmount("");
  }

  function handleCustomAmountChange(raw: string) {
    const numeric = raw.replace(/[^0-9]/g, "");
    setCustomAmount(numeric);
    const parsed = Number(numeric);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!memberName.trim()) {
      setErrorMessage("이름을 입력해주세요.");
      return;
    }
    if (!amount || amount <= 0) {
      setErrorMessage("후원 금액을 선택해주세요.");
      return;
    }
    if (!TOSS_CLIENT_KEY) {
      setErrorMessage("결제 모듈이 초기화되지 않았습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/donations/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          amount,
          memberName: memberName.trim(),
          memberPhone: memberPhone.trim() || undefined,
          memberEmail: memberEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "결제 준비에 실패했습니다.");
      }

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestPayment("카드", {
        amount: data.amount,
        orderId: data.orderId,
        orderName: data.orderName ?? campaign.title,
        customerName: memberName.trim(),
        customerEmail: memberEmail.trim() || undefined,
        successUrl: `${window.location.origin}/donate/success`,
        failUrl: `${window.location.origin}/donate/fail`,
      });
      // requestPayment 성공 시 redirect 가 일어나므로 여기 이후 코드는 실행되지 않음
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "결제 진행 중 오류가 발생했습니다."
      );
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border p-6"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberName"
          className="text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          이름 <span style={{ color: "var(--negative)" }}>*</span>
        </label>
        <input
          id="memberName"
          type="text"
          required
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          placeholder="홍길동"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberPhone"
          className="text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          연락처
        </label>
        <input
          id="memberPhone"
          type="tel"
          value={memberPhone}
          onChange={(e) => setMemberPhone(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          placeholder="010-1234-5678"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberEmail"
          className="text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          이메일
        </label>
        <input
          id="memberEmail"
          type="email"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          placeholder="donor@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          후원 금액 <span style={{ color: "var(--negative)" }}>*</span>
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_AMOUNTS.map((value) => {
            const selected = !customAmount && amount === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handlePresetAmount(value)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
                style={{
                  background: selected ? "var(--accent)" : "var(--surface-2)",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  color: selected ? "#ffffff" : "var(--text)",
                }}
              >
                {formatAmount(value)}원
              </button>
            );
          })}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={customAmount}
          onChange={(e) => handleCustomAmountChange(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          placeholder="직접 입력 (원)"
        />
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          결제 예정 금액: {formatAmount(amount || 0)}원
        </p>
      </div>

      {errorMessage && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            borderColor: "rgba(239,68,68,0.4)",
            color: "var(--negative)",
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: "var(--accent)",
          color: "#ffffff",
        }}
      >
        {loading ? "결제 진행중..." : "결제 진행"}
      </button>
    </form>
  );
}
