import type { Insight, InsightSeverity } from "@/lib/stats/insights";

const SEVERITY_CLASSES: Record<
  InsightSeverity,
  { card: string; action: string; icon: string }
> = {
  danger: {
    card: "border-l-4 border-l-red-500 border border-red-500/20 bg-red-500/5",
    action: "border-red-500 text-red-500",
    icon: "🔴",
  },
  warning: {
    card: "border-l-4 border-l-yellow-500 border border-yellow-500/20 bg-yellow-500/5",
    action: "border-yellow-500 text-yellow-500",
    icon: "🟡",
  },
  positive: {
    card: "border-l-4 border-l-green-500 border border-green-500/20 bg-green-500/5",
    action: "border-green-500 text-green-500",
    icon: "🟢",
  },
  info: {
    card: "border-l-4 border-l-[var(--accent)] border border-[var(--accent)]/20 bg-[var(--accent)]/5",
    action: "border-[var(--accent)] text-[var(--accent)]",
    icon: "ℹ️",
  },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const s = SEVERITY_CLASSES[insight.severity];
  return (
    <div className={`flex items-start gap-3 rounded-lg p-4 ${s.card}`}>
      <span className="flex-shrink-0 text-lg">{s.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-semibold text-[var(--text)]">{insight.title}</div>
        <div className="text-sm text-[var(--muted-foreground)]">{insight.message}</div>
      </div>
      {insight.actionLabel && insight.actionHref && (
        <a
          href={insight.actionHref}
          className={`flex-shrink-0 whitespace-nowrap rounded border px-3 py-1.5 text-xs font-medium ${s.action}`}
        >
          {insight.actionLabel}
        </a>
      )}
    </div>
  );
}
