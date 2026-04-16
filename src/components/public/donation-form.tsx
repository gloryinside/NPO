"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import type { Campaign } from "@/types/campaign";

const DEFAULT_PRESET_AMOUNTS = [10000, 30000, 50000, 100000];

const PAY_METHOD_LABEL: Record<string, string> = {
  card: "카드",
  transfer: "계좌이체",
  cms: "CMS",
  manual: "수기",
};

function formatAmount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

type OfflineConfirmData = {
  payMethod: string;
  donationType: string;
  paymentCode: string;
  amount: number;
  orderName: string;
  memberName: string;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
};

function OfflineConfirmScreen({ data }: { data: OfflineConfirmData }) {
  const isCms = data.payMethod === "cms";
  const label = isCms ? "CMS 자동이체" : "계좌이체";
  const hasBankInfo = data.bankAccount || data.bankName;

  return (
    <div
      className="rounded-xl border p-6 flex flex-col gap-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
          style={{ background: "rgba(34,197,94,0.12)" }}
        >
          ✓
        </div>
        <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          {label} 신청이 완료되었습니다
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          아래 계좌로 후원금을 입금해 주시면 처리됩니다.
        </p>
      </div>

      <div
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--muted-foreground)" }}>캠페인</span>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>{data.orderName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--muted-foreground)" }}>후원자</span>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>{data.memberName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--muted-foreground)" }}>후원 유형</span>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>
            {data.donationType === "regular" ? "정기 후원" : "일시 후원"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--muted-foreground)" }}>후원 금액</span>
          <span className="font-bold" style={{ color: "var(--accent)" }}>
            {formatAmount(data.amount)}원
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--muted-foreground)" }}>접수번호</span>
          <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
            {data.paymentCode}
          </span>
        </div>
      </div>

      {hasBankInfo && (
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: "var(--accent)",
            background: "rgba(124,58,237,0.06)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--accent)" }}>
            입금 계좌 안내
          </p>
          <div className="flex flex-col gap-1.5 text-sm">
            {data.bankName && (
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>은행</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{data.bankName}</span>
              </div>
            )}
            {data.bankAccount && (
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>계좌번호</span>
                <span className="font-mono" style={{ color: "var(--text)", fontWeight: 500 }}>
                  {data.bankAccount}
                </span>
              </div>
            )}
            {data.accountHolder && (
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>예금주</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{data.accountHolder}</span>
              </div>
            )}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted-foreground)" }}>
            입금 시 이름(후원자명)을 기재해 주세요. 입금 확인 후 후원이 처리됩니다.
          </p>
        </div>
      )}

      {!hasBankInfo && (
        <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
          담당자가 연락하여 입금 안내를 드릴 예정입니다.
        </p>
      )}

      {isCms && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--muted-foreground)",
          }}
        >
          CMS 자동이체는 신청 접수 후 담당자가 이체 동의서를 안내해 드립니다.
        </div>
      )}
    </div>
  );
}

export default function DonationForm({ campaign }: { campaign: Campaign }) {
  const presetAmounts =
    campaign.preset_amounts && campaign.preset_amounts.length > 0
      ? campaign.preset_amounts
      : DEFAULT_PRESET_AMOUNTS;

  const availableMethods =
    campaign.pay_methods && campaign.pay_methods.length > 0
      ? campaign.pay_methods
      : ["card"];

  const showTypeTabs =
    campaign.donation_type === "both" || !campaign.donation_type;

  const defaultType: "regular" | "onetime" =
    campaign.donation_type === "regular" ? "regular" : "onetime";

  const [donationType, setDonationType] = useState<"regular" | "onetime">(
    showTypeTabs ? "onetime" : defaultType
  );
  const [payMethod, setPayMethod] = useState<string>(availableMethods[0] ?? "card");
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [amount, setAmount] = useState<number>(presetAmounts[0] ?? 30000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlineConfirm, setOfflineConfirm] = useState<OfflineConfirmData | null>(null);

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

    setLoading(true);
    try {
      const res = await fetch("/api/donations/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          amount,
          donationType,
          payMethod,
          memberName: memberName.trim(),
          memberPhone: memberPhone.trim() || undefined,
          memberEmail: memberEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "결제 준비에 실패했습니다.");
      }

      // 오프라인 결제 (계좌이체·CMS): 계좌 안내 화면 표시
      if (data.offline) {
        setOfflineConfirm({
          payMethod: data.payMethod,
          donationType: data.donationType,
          paymentCode: data.paymentCode,
          amount: data.amount,
          orderName: data.orderName ?? campaign.title,
          memberName: data.memberName,
          bankName: data.bankName ?? null,
          bankAccount: data.bankAccount ?? null,
          accountHolder: data.accountHolder ?? null,
        });
        return;
      }

      if (!data.tossClientKey) {
        throw new Error("결제 설정이 누락되었습니다.");
      }

      const tossPayments = await loadTossPayments(data.tossClientKey);
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
    } finally {
      setLoading(false);
    }
  }

  // 오프라인 결제 완료 화면
  if (offlineConfirm) {
    return <OfflineConfirmScreen data={offlineConfirm} />;
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

      {/* 후원 유형 탭 */}
      {showTypeTabs && (
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {(["onetime", "regular"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDonationType(t)}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: donationType === t ? "var(--accent)" : "var(--surface-2)",
                color: donationType === t ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {t === "onetime" ? "일시 후원" : "정기 후원"}
            </button>
          ))}
        </div>
      )}

      {/* 결제 수단 */}
      {availableMethods.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            결제 수단
          </span>
          <div className="flex flex-wrap gap-2">
            {availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayMethod(m)}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  background: payMethod === m ? "var(--accent)" : "var(--surface-2)",
                  borderColor: payMethod === m ? "var(--accent)" : "var(--border)",
                  color: payMethod === m ? "#fff" : "var(--text)",
                }}
              >
                {PAY_METHOD_LABEL[m] ?? m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          후원 금액 <span style={{ color: "var(--negative)" }}>*</span>
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presetAmounts.map((value) => {
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
        {loading
          ? "처리 중..."
          : payMethod === "transfer" || payMethod === "cms"
          ? "후원 신청"
          : "결제 진행"}
      </button>
    </form>
  );
}
