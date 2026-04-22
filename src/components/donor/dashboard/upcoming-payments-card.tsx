import type { UpcomingPayment } from '@/lib/donor/upcoming-payments';

interface UpcomingPaymentsCardProps {
  payments: UpcomingPayment[];
}

function formatKRW(n: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(n)}원`;
}

function formatMDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

export function UpcomingPaymentsCard({ payments }: UpcomingPaymentsCardProps) {
  if (payments.length === 0) return null;
  const subtotal = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <section>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 0.75rem',
        }}
      >
        이번 달 예정 납입
      </h2>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {payments.map((p, i) => (
            <li
              key={p.promiseId}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr auto',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                fontSize: 14,
              }}
            >
              <span style={{ color: 'var(--muted-foreground)' }}>
                {formatMDay(p.scheduledDate)}
              </span>
              <span style={{ color: 'var(--text)' }}>
                정기후원 {p.campaignTitle ? `(${p.campaignTitle})` : ''}
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                {formatKRW(p.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            fontSize: 14,
            color: 'var(--text)',
          }}
        >
          <span style={{ color: 'var(--muted-foreground)', marginRight: 8 }}>
            소계:
          </span>
          <span style={{ fontWeight: 600 }}>{formatKRW(subtotal)}</span>
        </div>
      </div>
    </section>
  );
}
