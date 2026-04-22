'use client'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

interface Props {
  data: Array<{ date: string; amount: number; count: number }>
}

function formatShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`
  return n.toLocaleString('ko-KR')
}

export function ReportDailyChart({ data }: Props) {
  if (data.length === 0) return <p className="text-sm text-[var(--muted-foreground)] text-center py-8">결제 데이터가 없습니다.</p>

  // 누적 계산
  let cumulative = 0
  const chartData = data.map((d) => {
    cumulative += d.amount
    return { date: d.date.slice(5), 일별: d.amount, 누적: cumulative }
  })

  return (
    <div className="h-72 min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" />
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
          />
          <Line type="monotone" dataKey="일별" stroke="var(--info)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="누적" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
