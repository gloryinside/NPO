import type { CohortRow } from '@/lib/stats/cohort'

interface Props {
  rows: CohortRow[]
  horizonMonths: number
}

function cellColor(retention: number): { bg: string; text: string } {
  if (retention === 0) return { bg: 'var(--surface-2)', text: 'var(--muted-foreground)' }
  if (retention < 20) return { bg: 'var(--negative-soft)', text: 'var(--negative)' }
  if (retention < 50) return { bg: 'var(--warning-soft)', text: 'var(--warning)' }
  if (retention < 80) return { bg: 'var(--info-soft)', text: 'var(--info)' }
  return { bg: 'var(--positive-soft)', text: 'var(--positive)' }
}

export function CohortRetentionChart({ rows, horizonMonths }: Props) {
  const headers = Array.from({ length: horizonMonths }, (_, i) => `M${i + 1}`)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-[var(--muted-foreground)]">
            <th className="px-2 py-2 text-left font-medium">코호트</th>
            <th className="px-2 py-2 text-right font-medium">가입</th>
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 text-center font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohortMonth} className="border-t border-[var(--border)]">
              <td className="px-2 py-2 text-[var(--text)]">{r.cohortMonth}</td>
              <td className="px-2 py-2 text-right text-[var(--text)]">
                {r.size}명
              </td>
              {r.retention.map((val, i) => {
                const { bg, text } = cellColor(val)
                return (
                  <td
                    key={i}
                    className="px-2 py-2 text-center"
                    style={{ background: bg, color: text }}
                  >
                    {r.size > 0 ? `${val.toFixed(1)}%` : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
        M1–M{horizonMonths}: 가입 후 N개월차에 최소 1건 paid 결제가 있는 회원 비율.
      </p>
    </div>
  )
}
