import type { ImpactStorytellingData } from '@/lib/landing-variants/impact-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function ImpactStorytelling({ data }: { data: ImpactStorytellingData }) {
  const { title, blocks } = data
  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg)]">
      {title && (
        <div className="max-w-5xl mx-auto px-6 pt-20 text-center">
          <MotionFadeUp><h2 className="text-hero text-[var(--text)]">{title}</h2></MotionFadeUp>
        </div>
      )}
      <div className="space-y-0">
        {blocks.map((block, i) => (
          <div key={i} className="relative">
            {block.imageUrl && block.imagePosition !== 'none' && (
              <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.imageUrl} alt={block.headline} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}
            <div className="max-w-3xl mx-auto px-6 py-20 text-center">
              <MotionFadeUp>
                <h3 className="text-3xl md:text-4xl font-bold text-[var(--text)] mb-6 leading-tight">{block.headline}</h3>
              </MotionFadeUp>
              <MotionFadeUp delay={0.1}>
                <p className="text-lg leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line italic">
                  {block.body}
                </p>
              </MotionFadeUp>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
