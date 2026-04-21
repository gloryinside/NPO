import type { Insight, InsightSeverity } from "@/lib/stats/insights";

const SEVERITY_CLASSES: Record<
  InsightSeverity,
  { card: string; action: string; icon: string }
> = {
  danger: {
    card: "border-l-4 border-l-[var(--negative)] border border-[var(--negative)]/20 bg-[var(--negative)]/5",
    action: "border-[var(--negative)] text-[var(--negative)]",
    icon: "🔴",
  },
  warning: {
    card: "border-l-4 border-l-[var(--warning)] border border-[var(--warning)]/20 bg-[var(--warning)]/5",
    action: "border-[var(--warning)] text-[var(--warning)]",
    icon: "🟡",
  },
  positive: {
    card: "border-l-4 border-l-[var(--positive)] border border-[var(--positive)]/20 bg-[var(--positive)]/5",
    action: "border-[var(--positive)] text-[var(--positive)]",
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
