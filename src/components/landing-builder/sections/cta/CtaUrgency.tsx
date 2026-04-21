'use client'
import { useEffect, useState } from 'react'
import type { CtaUrgencyData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

function calcDdays(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export function CtaUrgency({ data }: { data: CtaUrgencyData }) {
  const { bgColor, headline, body, buttonText, buttonUrl, deadlineIso, goalAmount, raisedAmount } = data
  const [ddays, setDdays] = useState<number | null>(null)

  useEffect(() => { setDdays(calcDdays(deadlineIso)) }, [deadlineIso])

  const pct = goalAmount > 0 ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100) : 0

  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <MotionFadeUp>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-sm font-semibold text-white bg-[var(--negative)]/80">
            🔥 {ddays !== null ? (ddays >= 0 ? `D-${ddays}` : '마감') : '...'}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mx-auto mb-6 text-white/85">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.15}>
          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between text-xs mb-2 text-white/80">
              <span>{formatKRW(raisedAmount)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs mt-1 text-right text-white/70">목표 {formatKRW(goalAmount)}</div>
          </div>
        </MotionFadeUp>
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-10 py-3.5 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-hero)' }}>
            {buttonText} →
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
