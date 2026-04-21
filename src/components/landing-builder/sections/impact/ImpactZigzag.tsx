import type { ImpactZigzagData } from '@/lib/landing-variants/impact-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function ImpactZigzag({ data }: { data: ImpactZigzagData }) {
  const { title, blocks } = data
  return (
    <section className="border-b border-[var(--border)]">
      {title && (
        <div className="max-w-5xl mx-auto px-6 pt-16 text-center">
          <MotionFadeUp><h2 className="text-2xl font-bold text-[var(--text)]">{title}</h2></MotionFadeUp>
        </div>
      )}
      <div>
        {blocks.map((block, i) => {
          const hasImage = !!block.imageUrl && block.imagePosition !== 'none'
          const imageRight = block.imagePosition === 'right'
          const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--bg)'
          return (
            <div key={i} style={{ background: bg }}>
              <div className={`max-w-5xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-10 items-center ${hasImage && imageRight ? 'md:flex-row-reverse' : ''}`}>
                {hasImage && (
                  <MotionFadeUp className="w-full md:w-1/2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={block.imageUrl!} alt={block.headline}
                      className="w-full object-cover max-h-96"
                      style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-hero)' }} />
                  </MotionFadeUp>
                )}
                <MotionFadeUp delay={0.1} className={hasImage ? 'md:w-1/2' : 'w-full'}>
                  <h3 className="text-hero text-[var(--text)] mb-4">{block.headline}</h3>
                  <p className="text-base leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">{block.body}</p>
                </MotionFadeUp>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
