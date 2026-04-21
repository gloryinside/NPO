'use client'
import { useEffect, useState } from 'react'
import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'

export function LogosMarquee({ data }: { data: LogosBaseData }) {
  const { title, logos } = data
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const doubled = [...logos, ...logos]

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto py-10">
        {title && <h2 className="text-sm font-semibold mb-6 text-center text-[var(--muted-foreground)] uppercase tracking-wider px-6">{title}</h2>}
        {reduced ? (
          // G-70: reduced-motion fallback — grid 레이아웃으로 모든 로고 표시
          <div className="px-6 grid gap-6 items-center"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {logos.map((logo, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={logo.imageUrl} alt={logo.name}
                loading="lazy"
                className="max-h-10 w-full object-contain grayscale opacity-70" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden relative">
            <div className="flex gap-12 animate-marquee whitespace-nowrap">
              {doubled.map((logo, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={logo.imageUrl} alt={logo.name}
                  loading="lazy"
                  className="h-10 w-auto object-contain grayscale opacity-70 shrink-0" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
