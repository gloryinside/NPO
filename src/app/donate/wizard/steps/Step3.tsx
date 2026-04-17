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
      <div
        className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-soft)' }}
      >
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
      <h1 className="text-2xl font-bold">후원해 주셔서 감사합니다</h1>
      <p style={{ color: 'var(--muted-foreground)' }}>
        {state.amount.toLocaleString()}원{' '}
        {state.type === 'regular' ? '정기' : '일시'} 후원이 완료되었습니다.
      </p>
      {state.receiptOptIn && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          기부금 영수증은 등록하신 이메일로 발송됩니다.
        </p>
      )}
      {settings.completeRedirectUrl && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>잠시 후 자동으로 이동합니다…</p>
      )}
      <a
        href={`/campaigns/${campaign.slug}`}
        className="inline-block rounded px-4 py-2 text-sm"
        style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
      >
        캠페인으로 돌아가기
      </a>
    </div>
  );
}
