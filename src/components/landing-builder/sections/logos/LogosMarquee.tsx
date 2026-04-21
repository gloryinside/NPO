import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'

export function LogosMarquee({ data }: { data: LogosBaseData }) {
  const { title, logos } = data
  // 무한 스크롤: 같은 배열 2번 반복 + CSS translateX 애니메이션
  const doubled = [...logos, ...logos]
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto py-10">
        {title && <h2 className="text-sm font-semibold mb-6 text-center text-[var(--muted-foreground)] uppercase tracking-wider px-6">{title}</h2>}
        <div className="overflow-hidden relative">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {doubled.map((logo, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={logo.imageUrl} alt={logo.name}
                className="h-10 w-auto object-contain grayscale opacity-70 shrink-0" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
