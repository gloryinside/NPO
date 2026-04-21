'use client'

/**
 * 개별 섹션 설정 시트
 * 섹션 타입별로 편집 폼을 렌더링한다.
 */

import { useState } from 'react'
import type {
  LandingSection,
  HeroSectionData,
  StatsSectionData,
  StatItem,
  ImpactSectionData,
  ImpactBlock,
  CampaignsSectionData,
  DonationTiersSectionData,
  DonationTier,
  TeamSectionData,
  TeamMember,
  CtaSectionData,
  RichtextSectionData,
} from '@/types/landing'
import { ImageUploadField } from './ImageUploadField'

interface Props {
  section: LandingSection
  open: boolean
  onClose: () => void
  onSave: (id: string, data: LandingSection['data']) => void
}

export function LandingSectionSettingsSheet({ section, open, onClose, onSave }: Props) {
  const [data, setData] = useState<LandingSection['data']>(section.data)

  if (!open) return null

  function handleSave() {
    onSave(section.id, data)
    onClose()
  }

  function patch(partial: Partial<typeof data>) {
    setData(prev => ({ ...prev, ...partial }))
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 오버레이 */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* 시트 패널 */}
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">섹션 편집 — {section.type}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {/* 폼 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {section.type === 'hero' && (
            <HeroForm data={data as HeroSectionData} onChange={d => setData(d)} />
          )}
          {section.type === 'stats' && (
            <StatsForm data={data as StatsSectionData} onChange={d => setData(d)} />
          )}
          {section.type === 'impact' && (
            <ImpactForm data={data as ImpactSectionData} onChange={d => setData(d)} />
          )}
          {section.type === 'campaigns' && (
            <CampaignsForm data={data as CampaignsSectionData} onChange={patch} />
          )}
          {section.type === 'donation-tiers' && (
            <DonationTiersForm data={data as DonationTiersSectionData} onChange={d => setData(d)} />
          )}
          {section.type === 'team' && (
            <TeamForm data={data as TeamSectionData} onChange={d => setData(d)} />
          )}
          {section.type === 'cta' && (
            <CtaForm data={data as CtaSectionData} onChange={patch} />
          )}
          {section.type === 'richtext' && (
            <RichtextForm data={data as RichtextSectionData} onChange={patch} />
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 섹션별 폼 컴포넌트 ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const textareaCls = `${inputCls} min-h-[80px] resize-y`

function HeroForm({ data, onChange }: { data: HeroSectionData; onChange: (d: HeroSectionData) => void }) {
  const p = (partial: Partial<HeroSectionData>) => onChange({ ...data, ...partial })
  return <>
    <Field label="배경 타입">
      <select title="배경 타입 선택" className={inputCls} value={data.bgType} onChange={e => p({ bgType: e.target.value as 'color' | 'image' })}>
        <option value="color">단색</option>
        <option value="image">이미지</option>
      </select>
    </Field>
    <Field label={data.bgType === 'color' ? '배경 색상 (hex)' : '배경 이미지'}>
      {data.bgType === 'color' ? (
        <input className={inputCls} value={data.bgValue} onChange={e => p({ bgValue: e.target.value })} placeholder="#1a3a5c" />
      ) : (
        <ImageUploadField value={data.bgValue} onChange={url => p({ bgValue: url })} placeholder="https://... 또는 업로드" />
      )}
    </Field>
    <Field label="헤드라인">
      <input className={inputCls} value={data.headline} onChange={e => p({ headline: e.target.value })} />
    </Field>
    <Field label="서브 헤드라인">
      <input className={inputCls} value={data.subheadline ?? ''} onChange={e => p({ subheadline: e.target.value })} />
    </Field>
    <Field label="CTA 버튼 텍스트">
      <input className={inputCls} value={data.ctaText ?? ''} onChange={e => p({ ctaText: e.target.value })} />
    </Field>
    <Field label="CTA 버튼 URL">
      <input className={inputCls} value={data.ctaUrl ?? ''} onChange={e => p({ ctaUrl: e.target.value })} placeholder="#campaigns" />
    </Field>
    <Field label="텍스트 정렬">
      <select title="텍스트 정렬 선택" className={inputCls} value={data.textAlign ?? 'center'} onChange={e => p({ textAlign: e.target.value as 'left' | 'center' | 'right' })}>
        <option value="left">왼쪽</option>
        <option value="center">가운데</option>
        <option value="right">오른쪽</option>
      </select>
    </Field>
    {data.bgType === 'image' && (
      <Field label="오버레이 불투명도 (0-100)">
        <input type="number" className={inputCls} min={0} max={100} value={data.overlayOpacity ?? 40} onChange={e => p({ overlayOpacity: Number(e.target.value) })} />
      </Field>
    )}
  </>
}

function StatsForm({ data, onChange }: { data: StatsSectionData; onChange: (d: StatsSectionData) => void }) {
  function updateItem(i: number, partial: Partial<StatItem>) {
    const items = data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it)
    onChange({ ...data, items })
  }
  function addItem() { onChange({ ...data, items: [...data.items, { icon: '✨', value: '0', label: '항목' }] }) }
  function removeItem(i: number) { onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목">
      <input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} />
    </Field>
    {data.items.map((item, i) => (
      <div key={i} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">항목 {i + 1}</span>
          <button onClick={() => removeItem(i)} className="text-xs text-red-500">삭제</button>
        </div>
        <Field label="아이콘 (이모지)">
          <input className={inputCls} value={item.icon ?? ''} onChange={e => updateItem(i, { icon: e.target.value })} placeholder="📊" />
        </Field>
        <Field label="값">
          <input className={inputCls} value={item.value} onChange={e => updateItem(i, { value: e.target.value })} placeholder="1,200+" />
        </Field>
        <Field label="라벨">
          <input className={inputCls} value={item.label} onChange={e => updateItem(i, { label: e.target.value })} placeholder="누적 후원자" />
        </Field>
      </div>
    ))}
    <button onClick={addItem} className="w-full rounded-lg border-2 border-dashed border-border py-2 text-xs text-muted-foreground hover:border-blue-400 transition-colors">
      + 항목 추가
    </button>
  </>
}

function ImpactForm({ data, onChange }: { data: ImpactSectionData; onChange: (d: ImpactSectionData) => void }) {
  function updateBlock(i: number, partial: Partial<ImpactBlock>) {
    const blocks = data.blocks.map((b, idx) => idx === i ? { ...b, ...partial } : b)
    onChange({ ...data, blocks })
  }
  function addBlock() { onChange({ ...data, blocks: [...data.blocks, { headline: '', body: '', imagePosition: 'left' }] }) }
  function removeBlock(i: number) { onChange({ ...data, blocks: data.blocks.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목">
      <input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} />
    </Field>
    {data.blocks.map((block, i) => (
      <div key={i} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">블록 {i + 1}</span>
          <button onClick={() => removeBlock(i)} className="text-xs text-red-500">삭제</button>
        </div>
        <Field label="헤드라인"><input className={inputCls} value={block.headline} onChange={e => updateBlock(i, { headline: e.target.value })} /></Field>
        <Field label="본문"><textarea className={textareaCls} value={block.body} onChange={e => updateBlock(i, { body: e.target.value })} /></Field>
        <Field label="이미지"><ImageUploadField value={block.imageUrl ?? ''} onChange={url => updateBlock(i, { imageUrl: url })} /></Field>
        <Field label="이미지 위치">
          <select title="이미지 위치 선택" className={inputCls} value={block.imagePosition ?? 'left'} onChange={e => updateBlock(i, { imagePosition: e.target.value as 'left' | 'right' | 'none' })}>
            <option value="left">왼쪽</option>
            <option value="right">오른쪽</option>
            <option value="none">이미지 없음</option>
          </select>
        </Field>
      </div>
    ))}
    <button onClick={addBlock} className="w-full rounded-lg border-2 border-dashed border-border py-2 text-xs text-muted-foreground hover:border-blue-400 transition-colors">
      + 블록 추가
    </button>
  </>
}

function CampaignsForm({ data, onChange }: { data: CampaignsSectionData; onChange: (d: Partial<CampaignsSectionData>) => void }) {
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
    <Field label="서브 타이틀"><input className={inputCls} value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
    <Field label="최대 표시 개수">
      <select title="최대 표시 개수 선택" className={inputCls} value={data.maxCount ?? 3} onChange={e => onChange({ maxCount: Number(e.target.value) })}>
        {[2, 3, 4, 6].map(n => <option key={n} value={n}>{n}개</option>)}
      </select>
    </Field>
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={data.showProgress ?? true} onChange={e => onChange({ showProgress: e.target.checked })} className="accent-blue-600" />
      진행률 바 표시
    </label>
  </>
}

function DonationTiersForm({ data, onChange }: { data: DonationTiersSectionData; onChange: (d: DonationTiersSectionData) => void }) {
  function updateTier(i: number, partial: Partial<DonationTier>) {
    const tiers = data.tiers.map((t, idx) => idx === i ? { ...t, ...partial } : t)
    onChange({ ...data, tiers })
  }
  function addTier() { onChange({ ...data, tiers: [...data.tiers, { amount: 50000, icon: '⭐', label: '별 후원자', description: '' }] }) }
  function removeTier(i: number) { onChange({ ...data, tiers: data.tiers.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} /></Field>
    <Field label="서브 타이틀"><input className={inputCls} value={data.subtitle ?? ''} onChange={e => onChange({ ...data, subtitle: e.target.value })} /></Field>
    {data.tiers.map((tier, i) => (
      <div key={i} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">등급 {i + 1}</span>
          <button onClick={() => removeTier(i)} className="text-xs text-red-500">삭제</button>
        </div>
        <Field label="아이콘"><input className={inputCls} value={tier.icon ?? ''} onChange={e => updateTier(i, { icon: e.target.value })} placeholder="🌱" /></Field>
        <Field label="금액 (원)"><input type="number" className={inputCls} value={tier.amount} onChange={e => updateTier(i, { amount: Number(e.target.value) })} /></Field>
        <Field label="등급명"><input className={inputCls} value={tier.label} onChange={e => updateTier(i, { label: e.target.value })} /></Field>
        <Field label="설명"><textarea className={textareaCls} value={tier.description} onChange={e => updateTier(i, { description: e.target.value })} /></Field>
      </div>
    ))}
    <button onClick={addTier} className="w-full rounded-lg border-2 border-dashed border-border py-2 text-xs text-muted-foreground hover:border-blue-400 transition-colors">
      + 등급 추가
    </button>
  </>
}

function TeamForm({ data, onChange }: { data: TeamSectionData; onChange: (d: TeamSectionData) => void }) {
  function updateMember(i: number, partial: Partial<TeamMember>) {
    const members = data.members.map((m, idx) => idx === i ? { ...m, ...partial } : m)
    onChange({ ...data, members })
  }
  function addMember() { onChange({ ...data, members: [...data.members, { name: '', role: '' }] }) }
  function removeMember(i: number) { onChange({ ...data, members: data.members.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} /></Field>
    {data.members.map((member, i) => (
      <div key={i} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">멤버 {i + 1}</span>
          <button onClick={() => removeMember(i)} className="text-xs text-red-500">삭제</button>
        </div>
        <Field label="이름"><input className={inputCls} value={member.name} onChange={e => updateMember(i, { name: e.target.value })} /></Field>
        <Field label="직책"><input className={inputCls} value={member.role} onChange={e => updateMember(i, { role: e.target.value })} /></Field>
        <Field label="소개"><textarea className={textareaCls} value={member.bio ?? ''} onChange={e => updateMember(i, { bio: e.target.value })} /></Field>
        <Field label="사진"><ImageUploadField value={member.photoUrl ?? ''} onChange={url => updateMember(i, { photoUrl: url })} /></Field>
      </div>
    ))}
    <button onClick={addMember} className="w-full rounded-lg border-2 border-dashed border-border py-2 text-xs text-muted-foreground hover:border-blue-400 transition-colors">
      + 멤버 추가
    </button>
  </>
}

function CtaForm({ data, onChange }: { data: CtaSectionData; onChange: (d: Partial<CtaSectionData>) => void }) {
  return <>
    <Field label="헤드라인"><input className={inputCls} value={data.headline} onChange={e => onChange({ headline: e.target.value })} /></Field>
    <Field label="본문"><textarea className={textareaCls} value={data.body ?? ''} onChange={e => onChange({ body: e.target.value })} /></Field>
    <Field label="버튼 텍스트"><input className={inputCls} value={data.buttonText} onChange={e => onChange({ buttonText: e.target.value })} /></Field>
    <Field label="버튼 URL"><input className={inputCls} value={data.buttonUrl ?? ''} onChange={e => onChange({ buttonUrl: e.target.value })} placeholder="#campaigns" /></Field>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor ?? '#1a3a5c'} onChange={e => onChange({ bgColor: e.target.value })} /></Field>
  </>
}

function RichtextForm({ data, onChange }: { data: RichtextSectionData; onChange: (d: Partial<RichtextSectionData>) => void }) {
  return <>
    <Field label="제목 (선택)"><input className={inputCls} value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
    <Field label="HTML 내용">
      <textarea className={`${textareaCls} min-h-[160px] font-mono text-xs`} value={data.content} onChange={e => onChange({ content: e.target.value })} placeholder="<p>내용을 입력하세요.</p>" />
    </Field>
  </>
}
