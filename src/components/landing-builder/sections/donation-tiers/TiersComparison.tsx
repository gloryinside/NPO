import type { TiersBaseData } from '@/lib/landing-variants/tiers-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function TiersComparison({ data }: { data: TiersBaseData }) {
  const { title = '등급별 혜택 비교', subtitle, tiers } = data
  // 모든 혜택을 수집해서 행으로
  const allBenefits = Array.from(new Set(tiers.flatMap((t) => t.benefits ?? [])))

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}

        {allBenefits.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            혜택 정보가 없습니다. Settings에서 각 등급의 혜택을 추가해 주세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-3 text-[var(--muted-foreground)] font-medium">혜택</th>
                  {tiers.map((t, i) => (
                    <th key={i} className="p-3 text-center" style={{ minWidth: 120 }}>
                      {t.icon && <div className="text-2xl mb-1">{t.icon}</div>}
                      <div className="text-sm font-semibold text-[var(--text)]">{t.label}</div>
                      <div className="text-sm font-bold text-[var(--accent)]">{formatKRW(t.amount)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allBenefits.map((b, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="p-3 text-[var(--text)]">{b}</td>
                    {tiers.map((t, j) => (
                      <td key={j} className="p-3 text-center">
                        {t.benefits?.includes(b) ? (
                          <span className="text-[var(--positive)] font-bold">✓</span>
                        ) : (
                          <span className="text-[var(--border)]">−</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
