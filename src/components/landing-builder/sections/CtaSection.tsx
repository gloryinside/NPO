import type { CtaSectionData } from '@/types/landing'

interface Props {
  data: CtaSectionData
}

export function CtaSection({ data }: Props) {
  const { headline, body, buttonText, buttonUrl, bgColor } = data

  return (
    <section
      className="border-b border-[var(--border)]"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div
        className="max-w-4xl mx-auto px-6 py-20 text-center"
        style={!bgColor ? { background: 'var(--surface)' } : undefined}
      >
        <h2 className="text-3xl font-bold mb-4" style={{ color: bgColor ? '#fff' : 'var(--text)' }}>
          {headline}
        </h2>
        {body && (
          <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: bgColor ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}>
            {body}
          </p>
        )}
        <a
          href={buttonUrl || '#campaigns'}
          className="inline-flex items-center justify-center rounded-lg px-10 py-3.5 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
        >
          {buttonText}
        </a>
      </div>
    </section>
  )
}
