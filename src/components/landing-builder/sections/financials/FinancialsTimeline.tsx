'use client'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { FinancialsTimelineData } from '@/lib/landing-variants/financials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

export function FinancialsTimeline({ data }: { data: FinancialsTimelineData }) {
  const { title = '연도별 모금/사용', years } = data

  const chartData = years.map((y) => ({
    year: `${y.year}`,
    모금: y.raised,
    사용: y.used,
  }))

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2>
        </MotionFadeUp>
        <MotionFadeUp delay={0.1}>
          <div className="h-80 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" tickFormatter={formatShort} />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    return `${formatShort(n)}원`
                  }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-card)',
                    color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--muted-foreground)' }} />
                <Bar dataKey="모금" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="사용" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MotionFadeUp>
      </div>
    </section>
  )
}
