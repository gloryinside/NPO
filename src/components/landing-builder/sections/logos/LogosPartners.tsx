import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function LogosPartners({ data }: { data: LogosBaseData }) {
  const { title = '협력 기관', logos } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <MotionFadeUp>
          <h2 className="text-xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2>
        </MotionFadeUp>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {logos.map((logo, i) => (
            <MotionFadeUp key={i} delay={i * 0.05}>
              <div className="flex flex-col items-center gap-3 p-4 border border-[var(--border)] bg-[var(--bg)]"
                style={{ borderRadius: 'var(--radius-card)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.imageUrl} alt={logo.name} className="max-h-12 w-full object-contain" />
                <span className="text-xs text-[var(--muted-foreground)] text-center">{logo.name}</span>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
