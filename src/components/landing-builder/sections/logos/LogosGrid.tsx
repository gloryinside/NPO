import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function LogosGrid({ data }: { data: LogosBaseData }) {
  const { title, logos } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-14">
        {title && <MotionFadeUp><h2 className="text-lg font-semibold mb-8 text-center text-[var(--muted-foreground)] uppercase tracking-wider">{title}</h2></MotionFadeUp>}
        <div className="grid gap-6 items-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {logos.map((logo, i) => {
            const Inner = (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo.imageUrl} alt={logo.name}
                className="max-h-10 w-full object-contain grayscale hover:grayscale-0 transition-[filter] opacity-70 hover:opacity-100" />
            )
            return (
              <MotionFadeUp key={i} delay={i * 0.04}>
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
