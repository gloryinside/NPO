'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { EmptyArt, type EmptyIllustration } from '@/components/donor/ui/EmptyState'

/**
 * 공용 표 — 교육 없이 쓰는 사람을 기준으로 만든다.
 *  - 행 동작(편집·취소 등)은 늘 보인다(마우스를 올려야 나오면 터치·키보드 사용자는 찾지 못한다)
 *  - 행을 눌러 여는 표는 키보드(Enter·Space)로도 열린다
 *  - 열 제목을 누르면 정렬(sortValue가 있는 열만), 숫자는 자릿수가 맞게(tabular-nums)
 *  - 비어 있으면 "무엇을 하면 되는지"를 말하고 바로 그 버튼을 보여 준다
 */
export interface DataTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: T) => ReactNode
  /** 정렬 기준 값 — 주면 열 제목을 눌러 정렬할 수 있다 */
  sortValue?: (row: T) => string | number | null | undefined
  /** 제목 옆에 붙는 한 줄 설명(용어가 낯설 때) */
  hint?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  emptyMessage?: string
  /** 빈 상태에서 다음에 할 일 안내(한 문장) */
  emptyHint?: string
  /** 빈 상태에서 바로 누를 버튼 */
  emptyAction?: ReactNode
  /** 빈 상태 선화 일러스트(선택) */
  emptyIllustration?: EmptyIllustration
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  rowActions?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  /** 행을 눌렀을 때 무엇이 열리는지 — 스크린리더 안내용(예: "후원자 상세 열기") */
  rowLabel?: (row: T) => string
  /** 표 설명(스크린리더 caption) */
  caption?: string
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1 // 빈 값은 항상 뒤로
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ko')
}

export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const {
    columns,
    rows,
    rowKey,
    isLoading,
    emptyMessage = '아직 표시할 내용이 없습니다.',
    emptyHint,
    emptyAction,
    emptyIllustration,
    selectable,
    selectedIds,
    onSelectionChange,
    rowActions,
    onRowClick,
    rowLabel,
    caption,
  } = props

  const [sort, setSort] = useState<SortState>(null)
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => sign * compare(col.sortValue!(a), col.sortValue!(b)))
  }, [rows, columns, sort])

  const effectiveSelected = selectedIds ?? new Set<string>()
  const allSelected = rows.length > 0 && rows.every((r) => effectiveSelected.has(rowKey(r)))
  const someSelected = !allSelected && rows.some((r) => effectiveSelected.has(rowKey(r)))

  function toggleAll() {
    if (!onSelectionChange) return
    onSelectionChange(allSelected ? new Set() : new Set(rows.map((r) => rowKey(r))))
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return
    const next = new Set(effectiveSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  function toggleSort(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  const totalCols = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

  return (
    <div className="max-h-[70vh] overflow-auto overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {/* break-keep: 한글이 글자 단위로 줄바꿈돼 이름 칸이 세로로 깨지던 문제 */}
      <table className="w-full border-collapse break-keep text-[13px] tabular-nums">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-[1]">
          <tr className="bg-[var(--surface-2)] text-[var(--muted-foreground)]">
            {selectable && (
              <th scope="col" className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  aria-label="이 페이지 전체 선택"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </th>
            )}
            {columns.map((col) => {
              const active = sort?.key === col.key
              const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : col.sortValue ? 'none' : undefined
              const label = (
                <>
                  {col.header}
                  {col.hint && (
                    <span className="ml-1 cursor-help text-[var(--muted-2)]" title={col.hint} aria-label={`${col.header} 설명: ${col.hint}`}>
                      ⓘ
                    </span>
                  )}
                </>
              )
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${alignClass(col.align)}`}
                  style={{ width: col.width }}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 rounded hover:text-[var(--text)] ${active ? 'text-[var(--text)]' : ''}`}
                    >
                      {label}
                      <span aria-hidden className="text-[10px]">
                        {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    label
                  )}
                </th>
              )
            })}
            {rowActions && (
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <span className="sr-only">작업</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} data-slot="table-skeleton-row" className="border-t border-[var(--border)]">
                <td colSpan={totalCols} className="px-3 py-3">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)] motion-reduce:animate-none" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
                {emptyIllustration && <EmptyArt name={emptyIllustration} className="mb-3 h-36" />}
                <p className="font-medium text-[var(--text)]">{emptyMessage}</p>
                {emptyHint && <p className="mt-1">{emptyHint}</p>}
                {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => {
              const id = rowKey(row)
              const selected = effectiveSelected.has(id)
              return (
                <tr
                  key={id}
                  aria-selected={selectable ? selected : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  className={[
                    'border-t border-[var(--border)] transition-colors',
                    selected ? 'bg-[var(--accent-soft)]' : '',
                    onRowClick
                      ? 'cursor-pointer hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]'
                      : '',
                  ].join(' ')}
                >
                  {selectable && (
                    <td className="w-8 px-3 py-[7px]" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(id)}
                        aria-label="이 행 선택"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-[7px] ${alignClass(col.align)}`}>
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td
                      className="whitespace-nowrap px-3 py-[7px] text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {rowActions(row)}
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
