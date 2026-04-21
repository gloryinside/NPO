import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TeamFeatured({ data }: { data: TeamBaseData }) {
  const { title = '리더십', members } = data
  const [featured, ...rest] = members

  if (!featured) {
    return (
      <section className="border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-center text-sm text-[var(--muted-foreground)]">팀원 정보가 없습니다.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>
        <MotionFadeUp>
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start bg-[var(--surface)] border border-[var(--border)] p-8 mb-10"
            style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-card)' }}>
            {featured.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={featured.photoUrl} alt={featured.name}
                className="w-40 h-40 rounded-full object-cover border-4 border-[var(--accent)]/30" />
            ) : (
              <div className="w-40 h-40 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-6xl font-bold text-[var(--accent)]">
                {featured.name[0]}
              </div>
            )}
            <div className="flex-1 text-center md:text-left">
              <div className="text-2xl font-bold text-[var(--text)]">{featured.name}</div>
              <div className="text-sm font-semibold text-[var(--accent)] mt-1 mb-3">{featured.role}</div>
              {featured.bio && <p className="text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">{featured.bio}</p>}
            </div>
          </div>
        </MotionFadeUp>
        {rest.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {rest.map((m, i) => (
              <MotionFadeUp key={i} delay={i * 0.04}>
                <div className="flex flex-col items-center text-center gap-2">
                  {m.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.photoUrl} alt={m.name} className="w-16 h-16 rounded-full object-cover border border-[var(--border)]" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xl font-bold text-[var(--accent)]">
                      {m.name[0]}
                    </div>
                  )}
                  <div className="text-xs font-medium text-[var(--text)]">{m.name}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{m.role}</div>
                </div>
              </MotionFadeUp>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
