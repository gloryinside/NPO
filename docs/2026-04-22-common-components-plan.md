# 공통 컴포넌트 5종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 후원금 관리 시스템 전 페이지의 일관된 UX를 위한 5개 공통 컴포넌트(PageHeader, StatCard, FilterBar, DataTable, DetailDrawer) 구현 + /admin, /admin/payments, /admin/promises, /admin/members 4개 페이지 적용

**Architecture:** `src/components/common/` 하위에 독립 컴포넌트 5개를 각각 파일로 분리. CSS 변수 기반 스타일 가드레일 준수. `@testing-library/react` + vitest로 12개 유닛 테스트. 페이지 적용은 기존 코드 점진 마이그레이션.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript strict, Tailwind v4, base-ui/react (Dialog 기반), lucide-react (icons), vitest + @testing-library/react

---

## File Structure

| 파일 | 역할 |
|------|------|
| `src/components/common/stat-card.tsx` | 라벨 + 값 + 증감 배지 카드 |
| `src/components/common/page-header.tsx` | 제목 + 설명 + stats 슬롯 + actions + tabs |
| `src/components/common/filter-bar.tsx` | 검색 input + filters 슬롯 + 초기화 + FilterDropdown named export |
| `src/components/common/data-table.tsx` | 컴팩트 테이블 + 로딩/빈상태/선택/호버액션/행클릭 |
| `src/components/common/detail-drawer.tsx` | 우측 슬라이드 패널 (520px) + ESC/오버레이 닫기 |
| `tests/unit/common/stat-card.test.tsx` | 3 tests |
| `tests/unit/common/filter-bar.test.tsx` | 2 tests |
| `tests/unit/common/data-table.test.tsx` | 3 tests |
| `tests/unit/common/detail-drawer.test.tsx` | 2 tests |
| `tests/unit/common/page-header.test.tsx` | 2 tests |

**페이지 적용 (수정)**:
- `src/app/(admin)/admin/page.tsx` — KPI 카드를 StatCard로 교체
- `src/app/(admin)/admin/payments/page.tsx` + `src/components/admin/payment-list.tsx` — PageHeader + StatCard + FilterBar + DataTable + DetailDrawer
- `src/app/(admin)/admin/promises/page.tsx` + `src/components/admin/promise-list.tsx` — 동일 적용
- `src/app/(admin)/admin/members/page.tsx` + `src/components/admin/member-list.tsx` — 동일 적용

---

## Task 1: StatCard

**Files:**
- Create: `src/components/common/stat-card.tsx`
- Test: `tests/unit/common/stat-card.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// tests/unit/common/stat-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/common/stat-card'

describe('StatCard', () => {
  it('direction별 올바른 기호 렌더', () => {
    const { rerender } = render(
      <StatCard label="당월 수납" value="12,000원"
        delta={{ value: '+8%', direction: 'up', tone: 'positive' }} />
    )
    expect(screen.getByText(/▲/)).toBeTruthy()

    rerender(
      <StatCard label="미납" value="23건"
        delta={{ value: '+3건', direction: 'down', tone: 'negative' }} />
    )
    expect(screen.getByText(/▼/)).toBeTruthy()

    rerender(
      <StatCard label="CMS 성공률" value="94%"
        delta={{ value: '0%', direction: 'flat', tone: 'neutral' }} />
    )
    expect(screen.getByText(/―/)).toBeTruthy()
  })

  it('tone=negative일 때 값 색상 클래스 적용', () => {
    const { container } = render(
      <StatCard label="미납" value="23건" tone="negative" />
    )
    const valueEl = container.querySelector('[data-slot="stat-value"]')
    expect(valueEl?.className).toContain('var(--negative)')
  })

  it('delta 미지정 시 배지 렌더 안 함', () => {
    const { container } = render(
      <StatCard label="당월 수납" value="12,000원" />
    )
    expect(container.querySelector('[data-slot="stat-delta"]')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/stat-card.test.tsx 2>&1 | tail -10
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: StatCard 구현**

```tsx
// src/components/common/stat-card.tsx
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
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
          {label}
        </div>
        {delta && (
          <span
            data-slot="stat-delta"
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] ${DELTA_TONE_CLASS[delta.tone]}`}
          >
            <span aria-hidden="true">{DIRECTION_SYMBOL[delta.direction]}</span>
            {delta.value}
          </span>
        )}
      </div>
      <div
        data-slot="stat-value"
        className={`mt-1 text-[22px] font-bold ${VALUE_TONE_CLASS[tone]}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
          {hint}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/stat-card.test.tsx 2>&1 | tail -10
```

Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/common/stat-card.tsx tests/unit/common/stat-card.test.tsx && git commit -m "feat(common): StatCard 컴포넌트 + 3 unit tests"
```

---

## Task 2: PageHeader

**Files:**
- Create: `src/components/common/page-header.tsx`
- Test: `tests/unit/common/page-header.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// tests/unit/common/page-header.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/common/page-header'

describe('PageHeader', () => {
  it('기본: 제목만 렌더, stats/tabs 영역 숨김', () => {
    const { container } = render(<PageHeader title="대시보드" />)
    expect(screen.getByText('대시보드')).toBeTruthy()
    expect(container.querySelector('[data-slot="page-stats"]')).toBeNull()
    expect(container.querySelector('[data-slot="page-tabs"]')).toBeNull()
  })

  it('tabs 지정 시 탭 렌더 + activeTab 스타일', () => {
    const tabs = [
      { key: 'all', label: '전체', count: 100, href: '/x' },
      { key: 'paid', label: '완료', count: 80, href: '/x?s=paid' },
    ]
    render(<PageHeader title="납입 관리" tabs={tabs} activeTab="paid" />)
    expect(screen.getByText('전체')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
    const active = screen.getByText('완료').closest('a')
    expect(active?.getAttribute('data-active')).toBe('true')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/page-header.test.tsx 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: PageHeader 구현**

```tsx
// src/components/common/page-header.tsx
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
          <h1 className="text-[20px] font-bold text-[var(--text)]">{title}</h1>
          {description && (
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
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
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] transition-colors ${
                  active
                    ? 'border-b-2 border-[var(--accent)] font-medium text-[var(--accent)]'
                    : 'border-b-2 border-transparent text-[var(--muted-foreground)] hover:text-[var(--text)]'
                }`}
                style={{ marginBottom: '-1px' }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-[11px] opacity-70">{tab.count}</span>
                )}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/page-header.test.tsx 2>&1 | tail -10
```

Expected: 2 passed

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/common/page-header.tsx tests/unit/common/page-header.test.tsx && git commit -m "feat(common): PageHeader 컴포넌트 + 2 unit tests"
```

---

## Task 3: FilterBar + FilterDropdown

**Files:**
- Create: `src/components/common/filter-bar.tsx`
- Test: `tests/unit/common/filter-bar.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// tests/unit/common/filter-bar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/common/filter-bar'

describe('FilterBar', () => {
  it('hasActiveFilters=false일 때 초기화 버튼 숨김', () => {
    const { container } = render(
      <FilterBar hasActiveFilters={false} onReset={() => {}} />
    )
    expect(container.querySelector('[data-slot="filter-reset"]')).toBeNull()
  })

  it('hasActiveFilters=true + 초기화 클릭 시 onReset 호출', () => {
    const onReset = vi.fn()
    render(<FilterBar hasActiveFilters={true} onReset={onReset} />)
    fireEvent.click(screen.getByText('초기화'))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/filter-bar.test.tsx 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: FilterBar + FilterDropdown 구현**

```tsx
// src/components/common/filter-bar.tsx
'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export interface FilterBarProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (v: string) => void
  filters?: ReactNode
  onReset?: () => void
  hasActiveFilters?: boolean
}

export function FilterBar({
  searchPlaceholder = '검색',
  searchValue,
  onSearchChange,
  filters,
  onReset,
  hasActiveFilters,
}: FilterBarProps): ReactNode {
  return (
    <div className="mb-4 flex items-center gap-2">
      {onSearchChange && (
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            type="search"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-8 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      )}
      {filters}
      {hasActiveFilters && onReset && (
        <button
          data-slot="filter-reset"
          type="button"
          onClick={onReset}
          className="text-[12px] text-[var(--accent)] hover:underline"
        >
          초기화
        </button>
      )}
    </div>
  )
}

export interface FilterDropdownOption<V extends string> {
  value: V
  label: string
}

export interface FilterDropdownProps<V extends string> {
  label: string
  value: V | null
  options: FilterDropdownOption<V>[]
  onChange: (v: V | null) => void
  allowClear?: boolean
}

export function FilterDropdown<V extends string>({
  label,
  value,
  options,
  onChange,
  allowClear = true,
}: FilterDropdownProps<V>): ReactNode {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected ? selected.label : label

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
          selected
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
        }`}
      >
        {displayLabel}
        {selected && allowClear && (
          <X
            size={12}
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            className="ml-1 cursor-pointer opacity-70 hover:opacity-100"
          />
        )}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`block w-full px-3 py-1.5 text-left text-[13px] ${
                value === opt.value
                  ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/filter-bar.test.tsx 2>&1 | tail -10
```

Expected: 2 passed

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/common/filter-bar.tsx tests/unit/common/filter-bar.test.tsx && git commit -m "feat(common): FilterBar + FilterDropdown + 2 unit tests"
```

---

## Task 4: DataTable

**Files:**
- Create: `src/components/common/data-table.tsx`
- Test: `tests/unit/common/data-table.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// tests/unit/common/data-table.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type DataTableColumn } from '@/components/common/data-table'

interface Row { id: string; name: string }

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: '이름', render: (r) => r.name },
]

describe('DataTable', () => {
  it('rows=[] + emptyMessage 지정 시 메시지 렌더', () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="데이터가 없습니다."
      />
    )
    expect(screen.getByText('데이터가 없습니다.')).toBeTruthy()
  })

  it('isLoading=true 시 skeleton 렌더', () => {
    const { container } = render(
      <DataTable<Row>
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        isLoading
      />
    )
    const skeletons = container.querySelectorAll('[data-slot="table-skeleton-row"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('selectable + 행 체크박스 클릭 시 onSelectionChange 호출', () => {
    const rows: Row[] = [{ id: 'a', name: 'Alice' }]
    const onSelectionChange = vi.fn()
    render(
      <DataTable<Row>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectable
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    // [0] = header 전체선택, [1] = row
    fireEvent.click(checkboxes[1])
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['a']))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/data-table.test.tsx 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: DataTable 구현**

```tsx
// src/components/common/data-table.tsx
'use client'

import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  emptyMessage?: string
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  rowActions?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
}

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const {
    columns,
    rows,
    rowKey,
    isLoading,
    emptyMessage = '데이터가 없습니다.',
    selectable,
    selectedIds,
    onSelectionChange,
    rowActions,
    onRowClick,
  } = props

  const effectiveSelected = selectedIds ?? new Set<string>()
  const allSelected = rows.length > 0 && rows.every((r) => effectiveSelected.has(rowKey(r)))

  function toggleAll() {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(rows.map((r) => rowKey(r))))
    }
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return
    const next = new Set(effectiveSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const totalCols = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--surface-2)] text-[var(--muted-foreground)]">
            {selectable && (
              <th className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium ${alignClass(col.align)}`}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
            {rowActions && <th className="w-20 px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr
                key={i}
                data-slot="table-skeleton-row"
                className="border-t border-[var(--border)]"
              >
                <td colSpan={totalCols} className="px-3 py-3">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={totalCols}
                className="px-3 py-10 text-center text-[var(--muted-foreground)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row)
              const selected = effectiveSelected.has(id)
              return (
                <tr
                  key={id}
                  className={`group border-t border-[var(--border)] ${
                    selected ? 'bg-[var(--accent-soft)]' : ''
                  } ${onRowClick ? 'cursor-pointer hover:bg-[var(--surface-2)]' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td
                      className="w-8 px-3 py-[7px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(id)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-[7px] ${alignClass(col.align)}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td
                      className="w-20 px-3 py-[7px] text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">
                        {rowActions(row)}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/data-table.test.tsx 2>&1 | tail -10
```

Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/common/data-table.tsx tests/unit/common/data-table.test.tsx && git commit -m "feat(common): DataTable 컴포넌트 + 3 unit tests"
```

---

## Task 5: DetailDrawer

**Files:**
- Create: `src/components/common/detail-drawer.tsx`
- Test: `tests/unit/common/detail-drawer.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// tests/unit/common/detail-drawer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DetailDrawer } from '@/components/common/detail-drawer'

describe('DetailDrawer', () => {
  it('open=false일 때 렌더 안 함', () => {
    const { container } = render(
      <DetailDrawer open={false} onClose={() => {}} title="상세">
        <p>내용</p>
      </DetailDrawer>
    )
    expect(container.querySelector('[data-slot="drawer-panel"]')).toBeNull()
  })

  it('ESC 키 누르면 onClose 호출', () => {
    const onClose = vi.fn()
    render(
      <DetailDrawer open={true} onClose={onClose} title="상세">
        <p>내용</p>
      </DetailDrawer>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/detail-drawer.test.tsx 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: DetailDrawer 구현**

```tsx
// src/components/common/detail-drawer.tsx
'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: DetailDrawerProps): ReactNode {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
      />
      <div
        data-slot="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className="relative flex max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run tests/unit/common/detail-drawer.test.tsx 2>&1 | tail -10
```

Expected: 2 passed

- [ ] **Step 5: 전체 테스트 회귀 확인**

```bash
cd /Users/gloryinside/NPO_S && npx vitest run --project unit 2>&1 | tail -5
```

Expected: 241 passed (기존 229 + 이번 12)

- [ ] **Step 6: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/common/detail-drawer.tsx tests/unit/common/detail-drawer.test.tsx && git commit -m "feat(common): DetailDrawer 컴포넌트 + 2 unit tests"
```

---

## Task 6: /admin 대시보드 적용

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx`

기존 KPI 카드 4개를 StatCard로 교체하고 PageHeader 사용. 월별 추이 차트와 할 일은 기존 유지.

- [ ] **Step 1: import 추가**

`src/app/(admin)/admin/page.tsx` 상단 import 블록에 추가:

```typescript
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
```

- [ ] **Step 2: KPI 카드 교체**

기존 코드:

```tsx
<div>
  <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
  <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
    안녕하세요. NPO 후원관리 대시보드입니다.
  </p>

  {/* KPI 카드 */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    {kpiCards.map((card) => (
      <Card key={card.title} className="bg-[var(--surface)] border-[var(--border)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-[var(--muted-foreground)]">
            {card.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-2xl font-bold"
            style={{ color: card.negative ? "var(--negative)" : "var(--text)" }}
          >
            {card.value}
          </p>
        </CardContent>
      </Card>
    ))}
  </div>
```

아래로 교체:

```tsx
<div>
  <PageHeader
    title="대시보드"
    description="안녕하세요. NPO 후원관리 대시보드입니다."
    stats={
      <>
        <StatCard label="총 후원자 수" value={`${totalMembers.toLocaleString('ko-KR')}명`} />
        <StatCard label="이번 달 납입금액" value={formatKRW(monthAmount)} />
        <StatCard label="활성 캠페인" value={`${activeCampaigns}건`} />
        <StatCard label="미납/실패" value={`${unpaidCount}건`} tone={unpaidCount > 0 ? 'negative' : 'default'} />
      </>
    }
  />
```

**주의**: `kpiCards` 배열 선언 블록 (라인 163-168 근처)과 기존 import된 `Card, CardContent, CardHeader, CardTitle`를 **다른 용도로 쓰지 않는다면** 제거. 할 일 카드와 월별 추이는 여전히 Card를 쓰므로 import는 유지.

- [ ] **Step 3: 타입체크 + 빌드**

```bash
cd /Users/gloryinside/NPO_S && npx tsc --noEmit 2>&1 | head -15
cd /Users/gloryinside/NPO_S && npm run build 2>&1 | tail -10
```

Expected: 에러 없음, 빌드 성공

- [ ] **Step 4: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/app/\(admin\)/admin/page.tsx && git commit -m "feat(admin): /admin 대시보드에 PageHeader + StatCard 적용"
```

---

## Task 7: /admin/payments 적용

**Files:**
- Modify: `src/app/(admin)/admin/payments/page.tsx`
- Modify: `src/components/admin/payment-list.tsx`

추가 DB 쿼리 2개 (당월 수납 총액, CMS 성공률, 수입대기 수), StatCard 4개 + PageHeader + FilterBar + DataTable + DetailDrawer 적용.

- [ ] **Step 1: page.tsx에서 stats 데이터 쿼리 추가**

`src/app/(admin)/admin/payments/page.tsx` 기존 병렬 쿼리에 이어 추가하고, `PaymentList`에 prop으로 전달. 기존 파일 구조를 확인하고 아래 추가 쿼리를 기존 쿼리 영역에 `Promise.all` 내부로 병합:

```typescript
// 당월 범위 계산
const now = new Date()
const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
const nextFirstDay = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

const [
  paymentsRes,
  monthPaidRes,
  monthFailedRes,
  monthTotalRes,
  pendingIncomeRes,
] = await Promise.all([
  // 기존 payments 조회 유지
  (() => {
    let query = supabase
      .from('payments')
      .select('*, members(id, name, member_code), campaigns(id, title)', { count: 'exact' })
      .eq('org_id', tenant.id)
    if (status !== 'all') query = query.eq('pay_status', status)
    return query.order('pay_date', { ascending: false }).range(0, 99)
  })(),
  // 당월 완료 건 금액 합
  supabase
    .from('payments')
    .select('amount')
    .eq('org_id', tenant.id)
    .eq('pay_status', 'paid')
    .gte('pay_date', firstDay)
    .lt('pay_date', nextFirstDay),
  // 당월 실패 건 수
  supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('pay_status', 'failed')
    .gte('pay_date', firstDay)
    .lt('pay_date', nextFirstDay),
  // 당월 전체 시도 건 수 (성공률 계산용)
  supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .in('pay_status', ['paid', 'failed'])
    .gte('pay_date', firstDay)
    .lt('pay_date', nextFirstDay),
  // 수입대기 건 수
  supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('income_status', 'pending')
    .eq('pay_status', 'paid'),
])

const payments = (paymentsRes.data as unknown as PaymentWithRelations[]) ?? []
const total = paymentsRes.count ?? 0

const monthPaidTotal = (monthPaidRes.data ?? []).reduce(
  (s: number, r: { amount: number | null }) => s + Number(r.amount ?? 0),
  0
)
const monthFailed = monthFailedRes.count ?? 0
const monthAttempts = monthTotalRes.count ?? 0
const cmsSuccessRate =
  monthAttempts > 0 ? Math.round(((monthAttempts - monthFailed) / monthAttempts) * 100) : 100
const pendingIncomeCount = pendingIncomeRes.count ?? 0
```

이 데이터를 `PaymentList`에 prop으로 전달:

```tsx
<PaymentList
  payments={payments}
  total={total}
  initialStatus={status}
  stats={{
    monthPaidTotal,
    unpaidCount: monthFailed,
    cmsSuccessRate,
    pendingIncomeCount,
  }}
/>
```

- [ ] **Step 2: payment-list.tsx prop 확장**

기존 Props 타입 확장:

```typescript
type Props = {
  payments: PaymentWithRelations[]
  total: number
  initialStatus: string
  stats: {
    monthPaidTotal: number
    unpaidCount: number
    cmsSuccessRate: number
    pendingIncomeCount: number
  }
}
```

import 추가:

```typescript
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { FilterBar, FilterDropdown } from '@/components/common/filter-bar'
import { formatKRW } from '@/lib/format'
```

- [ ] **Step 3: PageHeader + StatCard 스트립 렌더**

`PaymentList` 컴포넌트 return 상단의 기존 `<div className="flex items-center justify-between mb-6">...</div>` 블록과 `STATUS_TABS` 탭 블록을 아래 PageHeader로 교체:

```tsx
const pageTabs = STATUS_TABS.map((t) => ({
  key: t.value,
  label: t.label,
  href: t.value === 'all' ? '/admin/payments' : `/admin/payments?status=${t.value}`,
}))

return (
  <div>
    <AddPaymentDialog
      open={showAddDialog}
      onClose={() => setShowAddDialog(false)}
      onCreated={() => { setShowAddDialog(false); router.refresh() }}
    />

    <PageHeader
      title="납입 관리"
      description={`총 ${total.toLocaleString('ko-KR')}건`}
      stats={
        <>
          <StatCard label="당월 수납" value={formatKRW(stats.monthPaidTotal)} />
          <StatCard
            label="미납/실패"
            value={`${stats.unpaidCount}건`}
            tone={stats.unpaidCount > 0 ? 'negative' : 'default'}
          />
          <StatCard
            label="CMS 성공률"
            value={`${stats.cmsSuccessRate}%`}
            tone={stats.cmsSuccessRate < 90 ? 'warning' : 'default'}
          />
          <StatCard label="수입대기" value={`${stats.pendingIncomeCount}건`} />
        </>
      }
      actions={
        <>
          <a
            href={`/api/admin/export/payments${
              initialStatus && initialStatus !== 'all' ? `?status=${initialStatus}` : ''
            }`}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            CSV 내보내기
          </a>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
          >
            + 납입 등록
          </Button>
        </>
      }
      tabs={pageTabs}
      activeTab={initialStatus}
    />

    {/* 기존 일괄 수입상태 변경 바 유지 */}
    {selected.size > 0 && (
      <div className="flex items-center gap-2 mb-3 p-3 rounded-lg border border-[var(--accent)] bg-[rgba(99,102,241,0.05)]">
        {/* 기존 코드 그대로 */}
      </div>
    )}

    {/* 기존 Table 영역 유지 (이 Task에서는 DataTable로 교체 안 함) */}
    <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
      {/* ... */}
    </div>
  </div>
)
```

**범위 제한**: 이 Task 7에서는 **PageHeader + StatCard만** 적용. FilterBar·DataTable·DetailDrawer 교체는 시간이 많이 걸리므로 Task 8에서 분리.

- [ ] **Step 4: 타입체크 + 빌드**

```bash
cd /Users/gloryinside/NPO_S && npx tsc --noEmit 2>&1 | head -15
cd /Users/gloryinside/NPO_S && npm run build 2>&1 | tail -10
```

Expected: 에러 없음, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/app/\(admin\)/admin/payments/page.tsx src/components/admin/payment-list.tsx && git commit -m "feat(admin): /admin/payments에 PageHeader + StatCard 스트립 적용"
```

---

## Task 8: /admin/payments에 DataTable + DetailDrawer 적용

**Files:**
- Modify: `src/components/admin/payment-list.tsx`

기존 shadcn Table + TableRow 블록을 공통 DataTable로 교체. 행 클릭 시 DetailDrawer 오픈.

- [ ] **Step 1: import 확장**

```typescript
import { DataTable, type DataTableColumn } from '@/components/common/data-table'
import { DetailDrawer } from '@/components/common/detail-drawer'
```

- [ ] **Step 2: 드로어 state 추가**

```typescript
const [detailTarget, setDetailTarget] = useState<PaymentWithRelations | null>(null)
```

- [ ] **Step 3: columns 정의**

```typescript
const columns: DataTableColumn<PaymentWithRelations>[] = [
  {
    key: 'payment_code',
    header: '결제코드',
    width: '130px',
    render: (p) => (
      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
        {p.payment_code}
      </span>
    ),
  },
  {
    key: 'member',
    header: '후원자',
    render: (p) => p.members?.name ?? '-',
  },
  {
    key: 'campaign',
    header: '캠페인',
    render: (p) => (
      <span className="text-[var(--muted-foreground)]">{p.campaigns?.title ?? '-'}</span>
    ),
  },
  {
    key: 'amount',
    header: '금액',
    align: 'right',
    width: '120px',
    render: (p) => (
      <span className="font-medium text-[var(--text)]">{formatAmount(p.amount)}</span>
    ),
  },
  {
    key: 'pay_date',
    header: '결제일',
    width: '110px',
    render: (p) => (
      <span className="text-[var(--muted-foreground)]">{formatDate(p.pay_date)}</span>
    ),
  },
  {
    key: 'pay_status',
    header: '납부상태',
    width: '80px',
    render: (p) => <PayStatusBadge status={p.pay_status} />,
  },
  {
    key: 'income_status',
    header: '수입상태',
    width: '90px',
    render: (p) => <IncomeStatusBadge status={p.income_status} />,
  },
]
```

- [ ] **Step 4: Table 영역을 DataTable + DetailDrawer로 교체**

기존 Table 영역 전체(`<div className="rounded-lg border overflow-hidden...">` ~ `</Table></div>`)를 아래로 교체:

```tsx
<DataTable<PaymentWithRelations>
  columns={columns}
  rows={payments}
  rowKey={(p) => p.id}
  emptyMessage="납입 내역이 없습니다."
  selectable
  selectedIds={selected}
  onSelectionChange={setSelected}
  onRowClick={(p) => setDetailTarget(p)}
  rowActions={(p) =>
    p.pay_status === 'paid' && p.toss_payment_key ? (
      <button
        type="button"
        onClick={() => setRefundTarget(p)}
        className="rounded border border-[var(--negative)] px-2 py-0.5 text-[11px] text-[var(--negative)] hover:bg-[var(--negative-soft)]"
      >
        환불
      </button>
    ) : null
  }
/>

<DetailDrawer
  open={!!detailTarget}
  onClose={() => setDetailTarget(null)}
  title={detailTarget ? `납입 상세 · ${detailTarget.payment_code}` : ''}
  subtitle={
    detailTarget
      ? `${detailTarget.members?.name ?? '-'} · ${formatAmount(detailTarget.amount)}`
      : undefined
  }
>
  {detailTarget && (
    <div className="flex flex-col gap-4 text-[13px]">
      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
          결제 정보
        </h3>
        <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
          <dt className="text-[var(--muted-foreground)]">결제일</dt>
          <dd className="text-[var(--text)]">{formatDate(detailTarget.pay_date)}</dd>
          <dt className="text-[var(--muted-foreground)]">결제수단</dt>
          <dd className="text-[var(--text)]">{detailTarget.pg_method ?? '-'}</dd>
          <dt className="text-[var(--muted-foreground)]">캠페인</dt>
          <dd className="text-[var(--text)]">{detailTarget.campaigns?.title ?? '-'}</dd>
          <dt className="text-[var(--muted-foreground)]">납부상태</dt>
          <dd><PayStatusBadge status={detailTarget.pay_status} /></dd>
          <dt className="text-[var(--muted-foreground)]">수입상태</dt>
          <dd><IncomeStatusBadge status={detailTarget.income_status} /></dd>
        </dl>
      </section>

      {detailTarget.fail_reason && (
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
            실패 사유
          </h3>
          <div className="rounded border border-[var(--negative)] bg-[var(--negative-soft)] p-3 text-[var(--negative)]">
            {detailTarget.fail_reason}
          </div>
        </section>
      )}

      {detailTarget.pay_status === 'refunded' && (
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
            환불 내역
          </h3>
          <div className="rounded border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[var(--text)]">
            {detailTarget.refund_amount != null
              ? `부분환불 ${formatAmount(detailTarget.refund_amount)}`
              : '전액환불'}
            {detailTarget.cancel_reason && (
              <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                사유: {detailTarget.cancel_reason}
              </div>
            )}
            {detailTarget.cancelled_at && (
              <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                처리 시각: {new Date(detailTarget.cancelled_at).toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )}
</DetailDrawer>
```

- [ ] **Step 5: 타입체크 + 빌드 + 테스트**

```bash
cd /Users/gloryinside/NPO_S && npx tsc --noEmit 2>&1 | head -15
cd /Users/gloryinside/NPO_S && npm run build 2>&1 | tail -10
cd /Users/gloryinside/NPO_S && npx vitest run --project unit 2>&1 | tail -5
```

Expected: 모두 성공, 241 tests passed

- [ ] **Step 6: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/components/admin/payment-list.tsx && git commit -m "feat(admin): payment-list DataTable + DetailDrawer 적용"
```

---

## Task 9: /admin/promises 적용

**Files:**
- Modify: `src/app/(admin)/admin/promises/page.tsx`
- Modify: `src/components/admin/promise-list.tsx`

현재 promise-list는 긴 파일 (800+ lines). 이 Task에서는 **PageHeader + StatCard만** 적용. DataTable 교체는 별도 2차 스펙.

- [ ] **Step 1: page.tsx 확장 — stats 쿼리**

`src/app/(admin)/admin/promises/page.tsx` 기존 쿼리에 추가:

```typescript
const [promisesRes, activeCountRes, cancelScheduledRes, overdueRes] = await Promise.all([
  // 기존 promises 조회 유지 (실제 파일 상태에 맞춰 유지)
  // ...,
  supabase
    .from('promises')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('status', 'active'),
  supabase
    .from('promises')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('status', 'cancel_scheduled'),
  // 연체: active 약정 중 최근 2회 연속 미납인 건 (간단 근사: pay_status='failed'가 2건 이상인 member)
  // YAGNI: 정확한 연체 계산은 별도 lib로 분리. 일단 failed 총건수로 근사.
  supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('pay_status', 'failed'),
])

const activeCount = activeCountRes.count ?? 0
const cancelScheduledCount = cancelScheduledRes.count ?? 0
const overdueCount = overdueRes.count ?? 0
```

PromiseList에 prop으로 전달:

```tsx
<PromiseList
  {...기존 props}
  stats={{ activeCount, cancelScheduledCount, overdueCount }}
/>
```

- [ ] **Step 2: promise-list.tsx Props 확장**

```typescript
type Props = {
  // 기존 props 유지
  stats: {
    activeCount: number
    cancelScheduledCount: number
    overdueCount: number
  }
}
```

import 추가:

```typescript
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
```

- [ ] **Step 3: 기존 헤더 블록을 PageHeader로 교체**

`PromiseList` 함수 내부 return 상단에 기존 h1/설명/버튼 블록과 탭 블록을 아래로 교체 (기존 구조를 유지하면서 헤더만 교체):

```tsx
<PageHeader
  title="약정 관리"
  description="정기/일시 후원 약정을 확인하고 관리합니다."
  stats={
    <>
      <StatCard label="활성 약정" value={`${stats.activeCount}건`} />
      <StatCard
        label="해지 예정"
        value={`${stats.cancelScheduledCount}건`}
        tone={stats.cancelScheduledCount > 0 ? 'warning' : 'default'}
      />
      <StatCard
        label="연체"
        value={`${stats.overdueCount}건`}
        tone={stats.overdueCount > 0 ? 'negative' : 'default'}
      />
    </>
  }
  actions={
    <Button
      onClick={() => setShowAddDialog(true)}
      className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
    >
      + 약정 등록
    </Button>
  }
/>
```

기존 테이블 영역은 **유지** (이번 범위에서 DataTable 교체 안 함).

- [ ] **Step 4: 타입체크 + 빌드**

```bash
cd /Users/gloryinside/NPO_S && npx tsc --noEmit 2>&1 | head -15
cd /Users/gloryinside/NPO_S && npm run build 2>&1 | tail -10
```

Expected: 성공

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/app/\(admin\)/admin/promises/page.tsx src/components/admin/promise-list.tsx && git commit -m "feat(admin): /admin/promises에 PageHeader + StatCard 스트립 적용"
```

---

## Task 10: /admin/members 적용

**Files:**
- Modify: `src/app/(admin)/admin/members/page.tsx`
- Modify: `src/components/admin/member-list.tsx`

- [ ] **Step 1: page.tsx 확장 — stats 쿼리**

`src/app/(admin)/admin/members/page.tsx` 기존 쿼리에 추가:

```typescript
// 신규 (최근 30일)
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

const [membersRes, activeCountRes, newCountRes, churnRiskRes] = await Promise.all([
  // 기존 members 조회 유지
  // ...,
  supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('status', 'active'),
  supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('status', 'active')
    .gte('created_at', thirtyDaysAgo),
  // 이탈위험: active 약정이 있으나 최근 60일 내 납입 없음 — 복잡하므로 근사로 실패 건수만
  supabase
    .from('payments')
    .select('member_id', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('pay_status', 'failed')
    .gte('pay_date', new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)),
])

const activeCount = activeCountRes.count ?? 0
const newCount = newCountRes.count ?? 0
const churnRiskCount = churnRiskRes.count ?? 0
```

MemberList에 prop으로 전달:

```tsx
<MemberList
  {...기존 props}
  stats={{ activeCount, newCount, churnRiskCount }}
/>
```

- [ ] **Step 2: member-list.tsx Props 확장**

```typescript
type Props = {
  // 기존 props 유지
  stats: {
    activeCount: number
    newCount: number
    churnRiskCount: number
  }
}
```

import 추가:

```typescript
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
```

- [ ] **Step 3: 기존 헤더 블록을 PageHeader로 교체**

```tsx
<PageHeader
  title="회원 관리"
  description="후원자 회원 정보와 약정을 관리합니다."
  stats={
    <>
      <StatCard label="활성 회원" value={`${stats.activeCount}명`} />
      <StatCard
        label="신규 (30일)"
        value={`${stats.newCount}명`}
        tone={stats.newCount > 0 ? 'default' : 'default'}
      />
      <StatCard
        label="이탈 위험"
        value={`${stats.churnRiskCount}명`}
        tone={stats.churnRiskCount > 0 ? 'warning' : 'default'}
      />
    </>
  }
  actions={
    <Button
      onClick={() => setShowAddDialog(true)}
      className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
    >
      + 회원 등록
    </Button>
  }
/>
```

기존 테이블 영역은 유지.

- [ ] **Step 4: 타입체크 + 빌드 + 테스트**

```bash
cd /Users/gloryinside/NPO_S && npx tsc --noEmit 2>&1 | head -15
cd /Users/gloryinside/NPO_S && npm run build 2>&1 | tail -10
cd /Users/gloryinside/NPO_S && npx vitest run --project unit 2>&1 | tail -5
```

Expected: 모두 성공, 241 passed

- [ ] **Step 5: 커밋**

```bash
cd /Users/gloryinside/NPO_S && git add src/app/\(admin\)/admin/members/page.tsx src/components/admin/member-list.tsx && git commit -m "feat(admin): /admin/members에 PageHeader + StatCard 스트립 적용"
```

---

## 수동 QA 체크리스트 (PR 머지 전)

브라우저에서 확인:

- [ ] `/admin` 대시보드 — KPI 카드가 StatCard 디자인 (라벨/값) 적용
- [ ] `/admin/payments` — 상단에 당월 수납/미납/CMS 성공률/수입대기 4개 스탯 스트립
- [ ] `/admin/payments` — 탭(전체/완료/대기/실패) PageHeader 내부에서 동작
- [ ] `/admin/payments` — 테이블 행 호버 시 "환불" 버튼 fade-in (paid + toss_payment_key 건만)
- [ ] `/admin/payments` — 행 클릭 시 우측 드로어 슬라이드 인, 결제 상세 표시
- [ ] `/admin/payments` — 드로어 ESC/오버레이/✕ 모두 닫힘
- [ ] `/admin/promises` — 활성/해지예정/연체 3개 스탯 스트립
- [ ] `/admin/members` — 활성/신규/이탈위험 3개 스탯 스트립
- [ ] 라이트/다크 테마 모두에서 가독성 확보
- [ ] 모바일 폭(~375px)에서 PageHeader·StatCard·FilterBar 레이아웃 자연스러움
