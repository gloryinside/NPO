import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TeamCards({ data }: { data: TeamBaseData }) {
  const { title = '팀 소개', members } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {members.map((m, i) => (
            <MotionFadeUp key={i} delay={i * 0.05}>
              <div className="relative overflow-hidden bg-[var(--bg)] border border-[var(--border)] group h-full"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                <div className="aspect-square">
                  {m.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.photoUrl} alt={m.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)] flex items-center justify-center text-5xl font-bold text-[var(--accent)]">
                      {m.name[0]}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-semibold text-[var(--text)]">{m.name}</div>
                  <div className="text-xs text-[var(--accent)] mt-1">{m.role}</div>
                </div>
                {m.bio && (
                  <div className="absolute inset-0 bg-[var(--bg)]/95 p-5 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="font-semibold text-[var(--text)] mb-1">{m.name}</div>
                    <div className="text-xs text-[var(--accent)] mb-3">{m.role}</div>
                    <p className="text-sm text-[var(--muted-foreground)] line-clamp-6">{m.bio}</p>
                  </div>
                )}
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
