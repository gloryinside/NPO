import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function GalleryFullbleed({ data }: { data: GalleryBaseData }) {
  const { title, images } = data
  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg)]">
      {title && (
        <div className="max-w-5xl mx-auto px-6 pt-16 text-center">
          <MotionFadeUp><h2 className="text-hero text-[var(--text)]">{title}</h2></MotionFadeUp>
        </div>
      )}
      <div>
        {images.map((img, i) => (
          <div key={i} className="relative">
            <div className="relative w-full h-[70vh] min-h-[400px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt} className="absolute inset-0 w-full h-full object-cover" />
              {img.caption && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                    <div className="max-w-5xl mx-auto">
                      <MotionFadeUp>
                        <p className="text-white text-xl md:text-2xl font-semibold leading-snug drop-shadow">
                          {img.caption}
                        </p>
                      </MotionFadeUp>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
