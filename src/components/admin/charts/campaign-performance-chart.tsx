"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

type Props = {
  data: { campaignTitle: string; paidAmount: number; unpaidAmount: number; rate: number }[];
};

export function CampaignPerformanceChart({ data }: Props) {
  const sliced = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={sliced}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="campaignTitle"
          width={100}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: unknown) => [`${Number(v).toLocaleString("ko-KR")}원`]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="paidAmount" name="납입액" radius={[0, 4, 4, 0]}>
          {sliced.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.rate >= 90
                  ? "var(--positive, #22c55e)"
                  : entry.rate >= 70
                    ? "var(--warning, #f59e0b)"
                    : "var(--negative, #ef4444)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
