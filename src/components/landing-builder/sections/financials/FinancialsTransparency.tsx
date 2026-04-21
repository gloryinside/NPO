import type { FinancialsTransparencyData } from '@/lib/landing-variants/financials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export function FinancialsTransparency({ data }: { data: FinancialsTransparencyData }) {
  const { title = '상세 사용 내역', year, totalRaised, totalUsed, items, reportUrl } = data
  const grandTotal = items.reduce((sum, i) => sum + i.amount, 0) || totalUsed

  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-5xl mx-auto px-6 py-20">
        <MotionFadeUp>
          <div className="text-center mb-12">
            {year && <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-2">{year}년 결산</p>}
            <h2 className="text-hero text-[var(--text)] mb-4">{title}</h2>
            <div className="flex flex-wrap justify-center gap-8 mt-6 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">총 모금 </span>
                <strong className="text-[var(--accent)]">{formatKRW(totalRaised)}</strong>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">총 집행 </span>
                <strong className="text-[var(--positive)]">{formatKRW(totalUsed)}</strong>
              </div>
            </div>
          </div>
        </MotionFadeUp>

        <MotionFadeUp delay={0.1}>
          <div className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
            style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-card)' }}>
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">항목</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">금액</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">비율</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">증빙</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const pct = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0
                  return (
                    <tr key={i} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[var(--text)]">{item.category}</div>
                        {item.note && <div className="text-xs text-[var(--muted-foreground)] mt-1">{item.note}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-[var(--text)]">{formatKRW(item.amount)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-[var(--accent)] w-8">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.documentUrl ? (
                          <a href={item.documentUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-semibold text-[var(--accent)] hover:underline">
                            📄 보기
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-2)] border-t-2 border-[var(--border)]">
                  <td className="px-6 py-4 text-sm font-bold text-[var(--text)]">합계</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-[var(--accent)]">{formatKRW(grandTotal)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-[var(--accent)]">100%</td>
                  <td className="px-6 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        </MotionFadeUp>

        {reportUrl && (
          <MotionFadeUp delay={0.2}>
            <div className="text-center mt-8">
              <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                style={{ boxShadow: 'var(--shadow-card)' }}>
                📊 감사보고서 전체 보기 →
              </a>
            </div>
          </MotionFadeUp>
        )}
      </div>
    </section>
  )
}
