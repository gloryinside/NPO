interface MonthCell {
  month: string  // YYYY-MM
  amount: number
  count: number
}

interface Props {
  data: MonthCell[]
  /** 표시할 연도 범위. 자동 감지: data 중 min/max 연도 */
}

const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/**
 * Phase 5-A: 월별 후원 히트맵.
 * - 행 = 연도, 열 = 월 (12칸)
 * - 색상 4단계: 0 / low / mid / high (분위수 기반)
 * - tooltip으로 월 총액·건수 표시
 */
export function ImpactMonthlyHeatmap({ data }: Props) {
  if (data.length === 0) return null

  // 연도 범위
  const years = Array.from(new Set(data.map((d) => d.month.slice(0, 4)))).map(Number).sort()
  const minYear = years[0]
  const maxYear = years[years.length - 1]

  // 분위수 기반 4단계
  const amounts = data.map((d) => d.amount).filter((n) => n > 0).sort((a, b) => a - b)
  const threshold = (p: number) => amounts.length > 0 ? amounts[Math.floor(amounts.length * p)] : 0
  const t33 = threshold(0.33)
  const t66 = threshold(0.66)

  function level(amount: number): 0 | 1 | 2 | 3 {
    if (amount === 0) return 0
    if (amount < t33) return 1
    if (amount < t66) return 2
    return 3
  }

  const LEVEL_COLORS = ['var(--surface-2)', 'color-mix(in oklch, var(--accent), transparent 70%)', 'color-mix(in oklch, var(--accent), transparent 40%)', 'var(--accent)']

  const byKey = new Map(data.map((d) => [d.month, d]))

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* 헤더 */}
        <div className="flex text-[10px] text-[var(--muted-foreground)] mb-2">
          <div className="w-14 flex-shrink-0" />
          {MONTH_LABELS.map((m) => (
            <div key={m} className="w-8 text-center">{m}월</div>
          ))}
        </div>
        {/* 연도별 행 */}
        {[...Array(maxYear - minYear + 1)].map((_, idx) => {
          const year = minYear + idx
          return (
            <div key={year} className="flex items-center mb-1">
              <div className="w-14 flex-shrink-0 text-xs text-[var(--muted-foreground)]">{year}</div>
              {MONTH_LABELS.map((_m, i) => {
                const key = `${year}-${String(i + 1).padStart(2, '0')}`
                const cell = byKey.get(key)
                const amt = cell?.amount ?? 0
                const cnt = cell?.count ?? 0
                const lv = level(amt)
                const title = amt > 0
                  ? `${year}년 ${i + 1}월: ${amt.toLocaleString('ko-KR')}원 · ${cnt}회`
                  : `${year}년 ${i + 1}월: 후원 없음`
                return (
                  <div
                    key={key}
                    className="w-8 h-8 rounded-sm m-0.5 transition-transform hover:scale-110"
                    style={{ background: LEVEL_COLORS[lv] }}
                    title={title}
                    aria-label={title}
                  />
                )
              })}
            </div>
          )
        })}
        {/* 범례 */}
        <div className="flex items-center gap-1.5 mt-3 text-[10px] text-[var(--muted-foreground)]">
          <span>적음</span>
          {LEVEL_COLORS.map((c, i) => (
            <div key={i} className="w-4 h-4 rounded-sm" style={{ background: c }} />
          ))}
          <span>많음</span>
        </div>
      </div>
    </div>
  )
}
