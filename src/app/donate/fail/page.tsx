import { cancelDonation } from '@/lib/donations/confirm';

type SP = Promise<{ code?: string; message?: string; orderId?: string }>;

export default async function DonateFailPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const code = sp.code ?? '';
  const message = sp.message ?? '결제가 취소되었거나 실패했습니다.';
  const orderId = sp.orderId ?? '';

  // orderId가 있으면 DB상 pending 결제를 cancelled로 마킹 (이미 paid면 건드리지 않음)
  if (orderId) {
    try {
      await cancelDonation(orderId, message);
    } catch (err) {
      console.error('[donate/fail] cancelDonation failed:', err);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-xl border p-8 text-center bg-[var(--surface)] border-[var(--border)]">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(239,68,68,0.12)' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path
              d="M10 10l12 12M22 10l-12 12"
              stroke="var(--negative)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--text)]">결제를 완료하지 못했습니다</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p>
        {code && (
          <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">코드: {code}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            캠페인 다시 보기
          </a>
          <a
            href="/donor/login"
            className="rounded-lg border px-4 py-2 text-sm border-[var(--border)] text-[var(--muted-foreground)]"
          >
            후원자 로그인
          </a>
        </div>

        <p className="mt-6 text-xs text-[var(--muted-foreground)]">
          문제가 반복된다면 기관에 문의해 주세요. 이미 청구된 금액은 자동 취소되며, 영업일 기준 3~5일 내 카드사 정책에 따라 환불됩니다.
        </p>
      </div>
    </main>
  );
}
