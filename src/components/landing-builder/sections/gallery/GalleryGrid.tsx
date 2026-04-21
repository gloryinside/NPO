import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { supabaseImage } from '../../shared/supabase-image'

export function GalleryGrid({ data }: { data: GalleryBaseData }) {
  const { title, images } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <MotionFadeUp key={i} delay={i * 0.03}>
              <figure className="overflow-hidden bg-[var(--surface)]" style={{ borderRadius: 'var(--radius-card)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={supabaseImage(img.url, { width: 400, quality: 75 })} alt={img.alt}
                  loading="lazy"
                  className="w-full aspect-square object-cover hover:scale-105 transition-transform duration-500" />
                {img.caption && <figcaption className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{img.caption}</figcaption>}
              </figure>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
