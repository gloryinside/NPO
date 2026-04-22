'use client'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

interface Props {
  data: Array<{ year: number; amount: number }>
}

function formatShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

export function ImpactYearlyBar({ data }: Props) {
  if (data.length === 0) return null
  const chartData = data.map((d) => ({ year: `${d.year}`, 후원액: d.amount }))

  return (
    <div className="h-64 min-h-[240px]">
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
              borderRadius: '12px',
              color: 'var(--text)',
            }}
            labelStyle={{ color: 'var(--text)' }}
          />
          <Bar dataKey="후원액" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
