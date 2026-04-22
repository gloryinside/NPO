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
