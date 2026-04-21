import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function LogosPress({ data }: { data: LogosBaseData }) {
  const { title = '언론에 소개된 우리', logos } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-5xl mx-auto px-6 py-14 text-center">
        <MotionFadeUp>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)] mb-2">As Seen In</p>
          <h2 className="text-xl font-bold mb-10 text-[var(--text)]">{title}</h2>
        </MotionFadeUp>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-10 items-center">
          {logos.map((logo, i) => {
            const Inner = (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo.imageUrl} alt={logo.name}
                className="max-h-12 w-full object-contain grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition" />
            )
            return (
              <MotionFadeUp key={i} delay={i * 0.05}>
                {logo.url
                  ? <a href={logo.url} target="_blank" rel="noopener noreferrer">{Inner}</a>
                  : Inner}
              </MotionFadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
