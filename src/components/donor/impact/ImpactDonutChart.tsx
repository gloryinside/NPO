'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface Props {
  data: Array<{ title: string; amount: number }>
}

const COLORS = ['#7c3aed', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#64748b']

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

export function ImpactDonutChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.amount, 0)
  if (total === 0) return null

  const chartData = data.map((d, i) => ({
    name: d.title,
    value: d.amount,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="h-72 min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={60} outerRadius={100} paddingAngle={2}>
            {chartData.map((e, i) => (
              <Cell key={i} fill={e.color} stroke="var(--bg)" strokeWidth={2} />
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
              borderRadius: '12px',
              color: 'var(--text)',
            }}
          />
          <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
