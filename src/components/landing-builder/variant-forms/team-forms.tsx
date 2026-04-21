'use client'
import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { ImageUploadField } from '../ImageUploadField'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[60px] resize-y`
const repeatGroupCls = 'rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2'
const removeBtnCls = 'text-xs text-[var(--negative)] hover:opacity-80 transition-opacity'
const addBtnCls = 'w-full rounded-md border-2 border-dashed border-[var(--border)] py-2 text-xs text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  )
}

/**
 * team-org-chart 전용 폼 — 각 멤버에 parent(상위 노드 name) 드롭다운 추가.
 * 자기 자신을 부모로 지정하거나 순환 참조 방지는 렌더러가 buildTree에서 처리.
 */
export function TeamOrgChartForm({ data, onChange }: { data: TeamBaseData; onChange: (d: TeamBaseData) => void }) {
  function update(i: number, partial: Partial<TeamBaseData['members'][0]>) {
    onChange({ ...data, members: data.members.map((m, idx) => idx === i ? { ...m, ...partial } : m) })
  }
  function add() { onChange({ ...data, members: [...data.members, { name: '', role: '' }] }) }
  function remove(i: number) { if (data.members.length > 1) onChange({ ...data, members: data.members.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    <p className="text-xs text-[var(--muted-foreground)] bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-md">
      💡 조직도 팁: 최상위 대표는 <strong>상위 노드</strong>를 비워두세요. 하위 팀원은 상위 노드에서 부모의 이름을 선택합니다.
    </p>
    {data.members.map((member, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">팀원 {i + 1}</span>
          {data.members.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="이름"><input className={inputCls} value={member.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
        <Field label="직책"><input className={inputCls} value={member.role} onChange={(e) => update(i, { role: e.target.value })} /></Field>
        <Field label="소개"><textarea className={textareaCls} value={member.bio ?? ''} onChange={(e) => update(i, { bio: e.target.value })} /></Field>
        <Field label="사진"><ImageUploadField value={member.photoUrl ?? ''} onChange={(url) => update(i, { photoUrl: url })} /></Field>
        <Field label="상위 노드 (없으면 최상위)">
          <select title="상위 노드" className={inputCls} value={member.parent ?? ''}
            onChange={(e) => update(i, { parent: e.target.value || undefined })}>
            <option value="">— 최상위 (대표 레벨) —</option>
            {data.members.filter((m) => m.name && m.name !== member.name).map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({m.role})</option>
            ))}
          </select>
        </Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 팀원 추가</button>
  </>
}
