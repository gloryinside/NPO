'use client'
import { useRouter } from 'next/navigation'

interface YearSelectorProps {
  currentYear: number
  selectedYear: number
  availableYears?: number[]
}

/**
 * SP-2: 임팩트 페이지 상단 연도 드롭다운.
 * 현재 연도 선택 시 /donor/impact, 그 외 /donor/impact/[year]로 이동.
 */
export function YearSelector({
  currentYear,
  selectedYear,
  availableYears,
}: YearSelectorProps) {
  const router = useRouter()
  const years =
    availableYears && availableYears.length > 0
      ? [...availableYears].sort((a, b) => b - a)
      : Array.from(
          { length: Math.max(1, currentYear - 2014) },
          (_, i) => currentYear - i,
        )

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">임팩트 연도 선택</span>
      <select
        value={selectedYear}
        aria-label="임팩트 연도 선택"
        onChange={(e) => {
          const y = parseInt(e.target.value, 10)
          if (y === currentYear) router.push('/donor/impact')
          else router.push(`/donor/impact/${y}`)
        }}
        className="rounded-lg border px-3 py-1.5 text-sm"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
    </label>
  )
}
