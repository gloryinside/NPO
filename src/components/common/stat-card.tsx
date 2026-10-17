import type { ReactNode } from 'react'

export interface StatCardDelta {
  value: string
  direction: 'up' | 'down' | 'flat'
  tone: 'positive' | 'negative' | 'neutral'
}

export interface StatCardProps {
  label: string
  value: string
  delta?: StatCardDelta
  hint?: string
  tone?: 'default' | 'negative' | 'warning'
}

const DIRECTION_SYMBOL: Record<StatCardDelta['direction'], string> = {
  up: '▲',
  down: '▼',
  flat: '―',
}

const DELTA_TONE_CLASS: Record<StatCardDelta['tone'], string> = {
  positive: 'text-[var(--positive)] bg-[var(--positive-soft)]',
  negative: 'text-[var(--negative)] bg-[var(--negative-soft)]',
  neutral: 'text-[var(--muted-foreground)] bg-[var(--surface-2)]',
}

const VALUE_TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-[var(--text)]',
  negative: 'text-[var(--negative)]',
  warning: 'text-[var(--warning)]',
}

export function StatCard({ label, value, delta, hint, tone = 'default' }: StatCardProps): ReactNode {
  return (
    <div
      data-slot="stat-card"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-[var(--muted-foreground)]">
          {label}
        </div>
        {delta && (
          <span
            data-slot="stat-delta"
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${DELTA_TONE_CLASS[delta.tone]}`}
          >
            <span aria-hidden="true">{DIRECTION_SYMBOL[delta.direction]}</span>
            {delta.value}
          </span>
        )}
      </div>
      <div
        data-slot="stat-value"
        className={`mt-2 text-[1.625rem] font-bold leading-none tracking-[-0.025em] tabular-nums ${VALUE_TONE_CLASS[tone]}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-xs text-[var(--muted-foreground)]">
          {hint}
        </div>
      )}
    </div>
  )
}
