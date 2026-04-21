import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TeamGrid({ data }: { data: TeamBaseData }) {
  const { title = '팀 소개', members } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {members.map((m, i) => (
            <MotionFadeUp key={i} delay={i * 0.05}>
              <div className="flex flex-col items-center text-center gap-3">
                {m.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.photoUrl} alt={m.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl font-bold text-[var(--accent)]">
                    {m.name[0]}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[var(--text)]">{m.name}</div>
                  <div className="text-xs text-[var(--accent)] mt-0.5">{m.role}</div>
                  {m.bio && <p className="text-xs text-[var(--muted-foreground)] mt-2 line-clamp-3">{m.bio}</p>}
                </div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
