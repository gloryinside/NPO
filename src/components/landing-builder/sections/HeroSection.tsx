import type { HeroSectionData } from '@/types/landing'

interface Props {
  data: HeroSectionData
}

export function HeroSection({ data }: Props) {
  const {
    bgType,
    bgValue,
    headline,
    subheadline,
    ctaText,
    ctaUrl,
    overlayOpacity = 50,
    textAlign = 'center',
  } = data

  const background =
    bgType === 'image'
      ? `linear-gradient(to bottom, rgba(10,10,15,${overlayOpacity / 100}), rgba(10,10,15,${Math.min(overlayOpacity / 100 + 0.3, 1)})), url(${JSON.stringify(bgValue)}) center/cover no-repeat`
      : bgValue || 'var(--surface)'

  const alignClass =
    textAlign === 'left' ? 'text-left items-start' :
    textAlign === 'right' ? 'text-right items-end' :
    'text-center items-center'

  const textColor = bgType === 'image' ? 'text-white' : 'text-[var(--text)]'
  const subColor = bgType === 'image' ? 'text-white/80' : 'text-[var(--muted-foreground)]'

  return (
    <section
      className="relative border-b border-[var(--border)]"
      style={{ background }}
    >
      <div className={`max-w-4xl mx-auto px-6 py-20 flex flex-col ${alignClass}`}>
        <h1 className={`text-4xl font-bold mb-4 ${textColor}`}>{headline}</h1>
        {subheadline && (
          <p className={`text-base max-w-2xl mb-8 ${subColor}`}>{subheadline}</p>
        )}
        {ctaText && (
          <a
            href={ctaUrl || '#'}
            className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
