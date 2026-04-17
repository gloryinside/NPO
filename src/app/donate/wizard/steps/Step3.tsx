'use client';
import { useEffect } from 'react';
import type { WizardState } from '../WizardClient';

declare global {
  interface Window {
    gtag?: (...a: unknown[]) => void;
  }
}

export function Step3({
  campaign,
  settings,
  state,
}: {
  campaign: { slug: string };
  settings: { completeRedirectUrl?: string | null };
  state: WizardState;
}) {
  useEffect(() => {
    window.gtag?.('event', 'purchase', { value: state.amount, currency: 'KRW' });
    if (settings.completeRedirectUrl) {
      setTimeout(() => {
        window.location.href = settings.completeRedirectUrl!;
      }, 3000);
    }
  }, []); // run once on mount

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)]">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M10 20l8 8 12-16"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[var(--text)]">후원해 주셔서 감사합니다</h1>
      <p className="text-[var(--muted-foreground)]">
        소중한 후원에 진심으로 감사드립니다.
      </p>

      {/* 결제 정보 요약 카드 */}
      <div className="mt-2 w-full rounded-xl p-4 text-left text-sm bg-[var(--surface-2)] border border-[var(--border)]">
        <div className="flex justify-between py-1.5">
          <span className="text-[var(--muted-foreground)]">금액</span>
          <span className="font-bold text-[var(--accent)]">
            {state.amount.toLocaleString('ko-KR')}원 ({state.type === 'regular' ? '정기' : '일시'})
          </span>
        </div>
        {state.paymentMethod && (
          <div className="flex justify-between py-1.5 border-t border-[var(--border)]">
            <span className="text-[var(--muted-foreground)]">결제수단</span>
            <span className="text-[var(--text)]">
              {{ card: '카드', kakaopay: '카카오페이', naverpay: '네이버페이', payco: 'PAYCO', virtual: '가상계좌', cms: 'CMS', transfer: '계좌이체' }[state.paymentMethod] ?? state.paymentMethod}
            </span>
          </div>
        )}
        {state.paymentCode && (
          <div className="flex justify-between py-1.5 border-t border-[var(--border)]">
            <span className="text-[var(--muted-foreground)]">접수번호</span>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">{state.paymentCode}</span>
          </div>
        )}
      </div>

      {state.receiptOptIn && (
        <p className="text-sm text-[var(--muted-foreground)]">
          기부금 영수증은 등록하신 이메일로 발송됩니다.
        </p>
      )}
      {settings.completeRedirectUrl && (
        <p className="text-xs text-[var(--muted-foreground)]">잠시 후 자동으로 이동합니다…</p>
      )}
      <a
        href={`/campaigns/${campaign.slug}`}
        className="inline-block rounded px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted-foreground)]"
      >
        캠페인으로 돌아가기
      </a>
    </div>
  );
}
