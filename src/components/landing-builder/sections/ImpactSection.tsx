import type { ImpactSectionData } from '@/types/landing'

interface Props {
  data: ImpactSectionData
}

export function ImpactSection({ data }: Props) {
  const { title, blocks } = data

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {title && (
          <h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2>
        )}
        <div className="space-y-14">
          {blocks.map((block, i) => {
            const hasImage = !!block.imageUrl && block.imagePosition !== 'none'
            const imageRight = block.imagePosition === 'right'

            return (
              <div
                key={i}
                className={`flex flex-col md:flex-row gap-8 items-center ${hasImage && imageRight ? 'md:flex-row-reverse' : ''}`}
              >
                {hasImage && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={block.imageUrl!}
                    alt={block.headline}
                    className="w-full md:w-1/2 rounded-xl object-cover max-h-72"
                  />
                )}
                <div className={hasImage ? 'md:w-1/2' : 'w-full'}>
                  <h3 className="text-xl font-bold mb-3 text-[var(--text)]">{block.headline}</h3>
                  <p className="text-base leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
                    {block.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
