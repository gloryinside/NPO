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
      <div className="text-5xl">🎉</div>
      <h1 className="text-2xl font-bold">후원해 주셔서 감사합니다</h1>
      <p className="text-neutral-600">
        {state.amount.toLocaleString()}원{' '}
        {state.type === 'regular' ? '정기' : '일시'} 후원이 완료되었습니다.
      </p>
      {state.receiptOptIn && (
        <p className="text-sm text-neutral-500">
          기부금 영수증은 등록하신 이메일로 발송됩니다.
        </p>
      )}
      {settings.completeRedirectUrl && (
        <p className="text-xs text-neutral-400">잠시 후 자동으로 이동합니다…</p>
      )}
      <a
        href={`/campaigns/${campaign.slug}`}
        className="inline-block rounded border px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        캠페인으로 돌아가기
      </a>
    </div>
  );
}
