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
