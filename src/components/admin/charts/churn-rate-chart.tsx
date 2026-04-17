"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Props = { data: { month: string; rate: number }[] };

export function ChurnRateChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--negative, #ef4444)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--negative, #ef4444)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => v.slice(5) + "월"}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          formatter={(v: unknown) => [`${Number(v)}%`, "이탈율"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <ReferenceLine
          y={20}
          stroke="var(--negative, #ef4444)"
          strokeDasharray="4 4"
          label={{ value: "20%", position: "right", fontSize: 10, fill: "var(--negative, #ef4444)" }}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--negative, #ef4444)"
          fill="url(#churnGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
