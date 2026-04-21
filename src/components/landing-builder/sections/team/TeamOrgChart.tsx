import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

interface MemberNode {
  member: TeamBaseData['members'][0]
  children: MemberNode[]
}

function buildTree(members: TeamBaseData['members']): MemberNode[] {
  const byName = new Map<string, MemberNode>()
  members.forEach((m) => byName.set(m.name, { member: m, children: [] }))
  const roots: MemberNode[] = []
  members.forEach((m) => {
    const node = byName.get(m.name)!
    if (m.parent && byName.has(m.parent)) {
      byName.get(m.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function NodeView({ node }: { node: MemberNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center text-center gap-2 border border-[var(--border)] bg-[var(--surface)] p-4 min-w-[160px]"
        style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
        {node.member.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={node.member.photoUrl} alt={node.member.name} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg font-bold text-[var(--accent)]">
            {node.member.name[0]}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">{node.member.name}</div>
          <div className="text-xs text-[var(--accent)]">{node.member.role}</div>
        </div>
      </div>
      {node.children.length > 0 && (
        <>
          <div className="w-px h-6 bg-[var(--border)]" aria-hidden />
          <div className="flex gap-6 pt-0 border-t border-[var(--border)] pt-6">
            {node.children.map((c, i) => <NodeView key={i} node={c} />)}
          </div>
        </>
      )}
    </div>
  )
}

export function TeamOrgChart({ data }: { data: TeamBaseData }) {
  const { title = '조직 구성', members } = data
  const tree = buildTree(members)

  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>
        <div className="overflow-x-auto">
          <div className="flex justify-center gap-8 min-w-full">
            {tree.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">팀원 정보가 없습니다.</p>
            ) : (
              tree.map((root, i) => <NodeView key={i} node={root} />)
            )}
          </div>
        </div>
        <p className="text-xs text-center text-[var(--muted-foreground)] mt-8">
          각 팀원의 <code className="bg-[var(--surface)] px-1">상위 노드(parent)</code> 필드로 계층을 구성합니다.
        </p>
      </div>
    </section>
  )
}
