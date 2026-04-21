import type { ImpactAlternatingData } from '@/lib/landing-variants/impact-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function ImpactAlternating({ data }: { data: ImpactAlternatingData }) {
  const { title, blocks } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-14 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="space-y-20">
          {blocks.map((block, i) => {
            const hasImage = !!block.imageUrl && block.imagePosition !== 'none'
            const imageRight = block.imagePosition === 'right'
            return (
              <MotionFadeUp key={i} delay={0}>
                <div className={`flex flex-col md:flex-row gap-10 items-center ${hasImage && imageRight ? 'md:flex-row-reverse' : ''}`}>
                  {hasImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={block.imageUrl!} alt={block.headline}
                      className="w-full md:w-1/2 object-cover max-h-80"
                      style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }} />
                  )}
                  <div className={hasImage ? 'md:w-1/2' : 'w-full'}>
                    <h3 className="text-2xl font-bold mb-4 text-[var(--text)]">{block.headline}</h3>
                    <p className="text-base leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">{block.body}</p>
                  </div>
                </div>
              </MotionFadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
