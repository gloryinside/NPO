'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type Props = {
  data: Array<{
    month: string
    upCount: number
    downCount: number
    sameCount: number
  }>
}

/**
 * Phase 6-A / G-105: 월별 약정 금액 변경 건수 Stacked Bar.
 * up=positive, down=negative, same=muted.
 */
export function PromiseChangeChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => v.slice(5) + '월'}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
          labelFormatter={(l: unknown) => `${String(l)} 변경`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="upCount"
          name="증액"
          stackId="a"
          fill="var(--positive)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="downCount"
          name="감액"
          stackId="a"
          fill="var(--negative)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="sameCount"
          name="동일"
          stackId="a"
          fill="var(--muted-foreground)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
