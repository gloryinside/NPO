'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { FinancialsBreakdownData } from '@/lib/landing-variants/financials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

const FALLBACK_COLORS = ['#7c3aed', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6']

export function FinancialsBreakdown({ data }: { data: FinancialsBreakdownData }) {
  const { title = '사용 내역 분포', year, totalUsed, breakdown } = data
  const total = breakdown.reduce((sum, b) => sum + b.amount, 0) || totalUsed

  const chartData = breakdown.map((b, i) => ({
    name: b.label,
    value: b.amount,
    color: b.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }))

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <div className="text-center mb-10">
            {year && <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-2">{year}년 결산</p>}
            <h2 className="text-2xl font-bold text-[var(--text)]">{title}</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">집행 총액 {formatKRW(totalUsed)}원</p>
          </div>
        </MotionFadeUp>
        <MotionFadeUp delay={0.1}>
          <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div className="h-72 min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="var(--bg)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value)
                      return `${formatKRW(n)}원 (${Math.round((n / total) * 100)}%)`
                    }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-card)',
                      color: 'var(--text)',
                    }}
                  />
                  <Legend wrapperStyle={{ color: 'var(--muted-foreground)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {chartData.map((c) => {
                const pct = Math.round((c.value / total) * 100)
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color }} />
                    <div className="flex-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm font-medium text-[var(--text)]">{c.name}</span>
                        <span className="text-sm font-bold text-[var(--accent)]">{pct}%</span>
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">{formatKRW(c.value)}원</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </MotionFadeUp>
      </div>
    </section>
  )
}
