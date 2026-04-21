import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function GalleryMasonry({ data }: { data: GalleryBaseData }) {
  const { title, images } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {images.map((img, i) => (
            <MotionFadeUp key={i} delay={i * 0.03} className="break-inside-avoid">
              <figure className="overflow-hidden bg-[var(--bg)]" style={{ borderRadius: 'var(--radius-card)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt}
                  className="w-full h-auto object-cover hover:opacity-80 transition-opacity" />
                {img.caption && <figcaption className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{img.caption}</figcaption>}
              </figure>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
