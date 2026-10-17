import Link from 'next/link'
import type { ReactNode } from 'react'

export interface PageHeaderTab {
  key: string
  label: string
  count?: number
  href: string
}

export interface PageHeaderProps {
  title: string
  description?: string
  stats?: ReactNode
  actions?: ReactNode
  tabs?: PageHeaderTab[]
  activeTab?: string
}

export function PageHeader({
  title,
  description,
  stats,
  actions,
  tabs,
  activeTab,
}: PageHeaderProps): ReactNode {
  return (
    <header className="mb-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.025em] text-[var(--text)]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {stats && (
        <div
          data-slot="page-stats"
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          {stats}
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <nav
          data-slot="page-tabs"
          className="flex gap-1 border-b border-[var(--border)]"
        >
          {tabs.map((tab) => {
            const active = tab.key === activeTab
            return (
              <Link
                key={tab.key}
                href={tab.href}
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'border-b-2 border-[var(--text)] font-semibold text-[var(--text)]'
                    : 'border-b-2 border-transparent text-[var(--muted-foreground)] hover:text-[var(--text)]'
                }`}
                style={{ marginBottom: '-1px' }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--muted-foreground)]">
                    {tab.count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
