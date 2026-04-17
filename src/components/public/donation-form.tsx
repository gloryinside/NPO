"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import type { Campaign } from "@/types/campaign";
import DonationTypeToggle from "@/components/public/donation/DonationTypeToggle";
import PayMethodSelector from "@/components/public/donation/PayMethodSelector";
import AmountSelector from "@/components/public/donation/AmountSelector";
import StickyCtaButton from "@/components/public/donation/StickyCtaButton";

const DEFAULT_PRESET_AMOUNTS = [10000, 30000, 50000, 100000];


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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col gap-5">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 bg-green-500/10">
          ✓
        </div>
        <h2 className="text-lg font-bold text-[var(--text)]">
          {label} 신청이 완료되었습니다
        </h2>
        <p className="text-sm mt-1 text-[var(--muted-foreground)]">
          아래 계좌로 후원금을 입금해 주시면 처리됩니다.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">캠페인</span>
          <span className="text-[var(--text)] font-medium">{data.orderName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">후원자</span>
          <span className="text-[var(--text)] font-medium">{data.memberName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">후원 유형</span>
          <span className="text-[var(--text)] font-medium">
            {data.donationType === "regular" ? "정기 후원" : "일시 후원"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">후��� 금액</span>
          <span className="font-bold text-[var(--accent)]">
            {formatAmount(data.amount)}원
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">��수번호</span>
          <span className="font-mono text-xs text-[var(--muted-foreground)]">
            {data.paymentCode}
          </span>
        </div>
      </div>

      {hasBankInfo && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent)]/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-[var(--accent)]">
            입금 계좌 안내
          </p>
          <div className="flex flex-col gap-1.5 text-sm">
            {data.bankName && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">은행</span>
                <span className="text-[var(--text)] font-medium">{data.bankName}</span>
              </div>
            )}
            {data.bankAccount && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">계좌번호</span>
                <span className="font-mono text-[var(--text)] font-medium">
                  {data.bankAccount}
                </span>
              </div>
            )}
            {data.accountHolder && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">예금주</span>
                <span className="text-[var(--text)] font-medium">{data.accountHolder}</span>
              </div>
            )}
          </div>
          <p className="text-xs mt-3 text-[var(--muted-foreground)]">
            입금 시 이름(후원자명)을 기재해 주세요. 입금 확인 후 후원이 처리됩니다.
          </p>
        </div>
      )}

      {!hasBankInfo && (
        <p className="text-sm text-center text-[var(--muted-foreground)]">
          담당자가 연락하여 입금 안내를 드릴 예정입니다.
        </p>
      )}

      {isCms && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-foreground)] px-4 py-3 text-sm">
          CMS ��동이체는 신청 접수 후 담당자가 이체 동의서를 안내해 드립니다.
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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlineConfirm, setOfflineConfirm] = useState<OfflineConfirmData | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!memberName.trim()) {
      setErrorMessage("이��을 입력해주세요.");
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
        throw new Error("결제 ���정이 누락되었습니다.");
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
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "결제 진행 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  if (offlineConfirm) {
    return <OfflineConfirmScreen data={offlineConfirm} />;
  }

  return (
    <form
      data-donation-form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberName"
          className="text-sm font-medium text-[var(--text)]"
        >
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          id="memberName"
          type="text"
          required
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none"
          placeholder="홍길��"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberPhone"
          className="text-sm font-medium text-[var(--text)]"
        >
          연락처
        </label>
        <input
          id="memberPhone"
          type="tel"
          value={memberPhone}
          onChange={(e) => setMemberPhone(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none"
          placeholder="010-1234-5678"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="memberEmail"
          className="text-sm font-medium text-[var(--text)]"
        >
          이메일
        </label>
        <input
          id="memberEmail"
          type="email"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none"
          placeholder="donor@example.com"
        />
      </div>

      {showTypeTabs && (
        <DonationTypeToggle
          value={donationType}
          available={["onetime", "regular"]}
          onChange={setDonationType}
        />
      )}

      <PayMethodSelector
        methods={availableMethods}
        value={payMethod}
        onChange={setPayMethod}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--text)]">
          후원 금액 <span className="text-red-500">*</span>
        </span>
        <AmountSelector
          presets={presetAmounts}
          allowCustom={true}
          value={amount}
          onChange={(a) => setAmount(a ?? 0)}
        />
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-500 px-3 py-2 text-sm">
          {errorMessage}
        </div>
      )}

      <StickyCtaButton
        label={payMethod === "transfer" || payMethod === "cms" ? "후��� 신청" : "결제 진행"}
        onClick={() => {
          const form = document.querySelector('form[data-donation-form]') as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        disabled={!memberName.trim() || !amount || amount <= 0}
        loading={loading}
      />
    </form>
  );
}
