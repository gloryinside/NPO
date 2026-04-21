import type { TeamSectionData } from '@/types/landing'

interface Props {
  data: TeamSectionData
}

export function TeamSection({ data }: Props) {
  const { title = '팀 소개', members } = data

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {members.map((member, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              {member.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl font-bold text-[var(--accent)]">
                  {member.name[0]}
                </div>
              )}
              <div>
                <div className="font-semibold text-[var(--text)]">{member.name}</div>
                <div className="text-xs text-[var(--accent)] mt-0.5">{member.role}</div>
                {member.bio && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2 line-clamp-3">
                    {member.bio}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
