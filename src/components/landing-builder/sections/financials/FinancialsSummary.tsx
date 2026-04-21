import type { FinancialsSummaryData } from '@/lib/landing-variants/financials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { CountUp } from '../../shared/CountUp'

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만원`
  return `${n.toLocaleString('ko-KR')}원`
}

export function FinancialsSummary({ data }: { data: FinancialsSummaryData }) {
  const { title = '재무 투명성', year, totalRaised, totalUsed, balance } = data
  const effectiveBalance = balance ?? totalRaised - totalUsed

  const cards = [
    { label: '총 모금액', value: totalRaised, icon: '💰', color: 'var(--accent)' },
    { label: '집행액', value: totalUsed, icon: '📊', color: 'var(--positive)' },
    { label: '잔액', value: effectiveBalance, icon: '🏦', color: 'var(--info)' },
  ]

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <div className="text-center mb-12">
            {year && <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-2">{year}년 기준</p>}
            <h2 className="text-2xl font-bold text-[var(--text)]">{title}</h2>
          </div>
        </MotionFadeUp>
        <div className="grid gap-5 sm:grid-cols-3">
          {cards.map((c, i) => (
            <MotionFadeUp key={i} delay={i * 0.1}>
              <div className="p-6 bg-[var(--bg)] border border-[var(--border)] text-center hover:-translate-y-1 transition-transform"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                <div className="text-3xl mb-3">{c.icon}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: c.color }}>
                  <CountUp value={formatKRW(c.value)} />
                </div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
