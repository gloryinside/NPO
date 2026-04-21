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
import type {
  HeroMinimalData, HeroSplitImageData, HeroFullscreenImageData,
  HeroFullscreenVideoData, HeroGalleryData, HeroStatsOverlayData,
} from '@/lib/landing-variants/hero-schemas'
import type {
  CtaBannerData, CtaGradientData, CtaSplitData, CtaUrgencyData, CtaFullscreenData,
} from '@/lib/landing-variants/cta-schemas'
import type { StatsBigData } from '@/lib/landing-variants/stats-schemas'
import {
  HeroMinimalForm, HeroSplitImageForm, HeroFullscreenImageForm,
  HeroFullscreenVideoForm, HeroGalleryForm, HeroStatsOverlayForm,
} from './variant-forms/hero-forms'
import {
  CtaBannerForm, CtaGradientForm, CtaSplitForm, CtaUrgencyForm, CtaFullscreenForm,
} from './variant-forms/cta-forms'
import { StatsBigForm } from './variant-forms/stats-forms'

interface Props {
  section: LandingSection
  open: boolean
  onClose: () => void
  onSave: (id: string, data: LandingSection['data']) => void
  onRequestVariantChange?: () => void
}

export function LandingSectionSettingsSheet({ section, open, onClose, onSave, onRequestVariantChange }: Props) {
  const [data, setData] = useState<LandingSection['data']>(section.data)

  if (!open) return null

  function handleSave() {
    onSave(section.id, data)
    onClose()
  }

  function patch(partial: Partial<typeof data>) {
    setData(prev => ({ ...prev, ...partial }))
  }

  const catalogLabel = SECTION_LABELS[section.type] ?? section.type

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 오버레이 */}
      <button
        type="button"
        aria-label="닫기"
        className="flex-1 bg-black/40"
        onClick={onClose}
      />

      {/* 시트 패널 */}
      <div
        className="w-full max-w-md border-l flex flex-col overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">섹션 편집</p>
            <h3 className="text-base font-semibold text-[var(--text)] mt-0.5">{catalogLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--text)] text-lg"
          >
            ✕
          </button>
        </div>

        {/* Variant 전환 버튼 */}
        {onRequestVariantChange && (
          <div className="px-5 pt-3">
            <button
              type="button"
              onClick={onRequestVariantChange}
              className="w-full rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
            >
              🎨 Variant 전환 (현재: {section.variant})
            </button>
          </div>
        )}

        {/* 폼 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {section.type === 'hero' && section.variant === 'hero-minimal' && (
            <HeroMinimalForm data={data as HeroMinimalData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'hero' && section.variant === 'hero-split-image' && (
            <HeroSplitImageForm data={data as HeroSplitImageData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'hero' && section.variant === 'hero-fullscreen-image' && (
            <HeroFullscreenImageForm data={data as HeroFullscreenImageData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'hero' && section.variant === 'hero-fullscreen-video' && (
            <HeroFullscreenVideoForm data={data as HeroFullscreenVideoData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'hero' && section.variant === 'hero-gallery' && (
            <HeroGalleryForm data={data as HeroGalleryData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'hero' && section.variant === 'hero-stats-overlay' && (
            <HeroStatsOverlayForm data={data as HeroStatsOverlayData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {/* hero legacy fallback (v1 데이터에 variant 없을 때) */}
          {section.type === 'hero' && !section.variant.startsWith('hero-') && (
            <HeroForm data={data as HeroSectionData} onChange={d => setData(d)} />
          )}

          {section.type === 'stats' && section.variant === 'stats-big' && (
            <StatsBigForm data={data as StatsBigData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'stats' && section.variant !== 'stats-big' && (
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
          {section.type === 'cta' && section.variant === 'cta-banner' && (
            <CtaBannerForm data={data as CtaBannerData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'cta' && section.variant === 'cta-gradient' && (
            <CtaGradientForm data={data as CtaGradientData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'cta' && section.variant === 'cta-split' && (
            <CtaSplitForm data={data as CtaSplitData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'cta' && section.variant === 'cta-urgency' && (
            <CtaUrgencyForm data={data as CtaUrgencyData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {section.type === 'cta' && section.variant === 'cta-fullscreen' && (
            <CtaFullscreenForm data={data as CtaFullscreenData} onChange={d => setData(d as LandingSection['data'])} />
          )}
          {/* cta legacy fallback */}
          {section.type === 'cta' && !section.variant.startsWith('cta-') && (
            <CtaForm data={data as CtaSectionData} onChange={patch} />
          )}
          {section.type === 'richtext' && (
            <RichtextForm data={data as RichtextSectionData} onChange={patch} />
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--text)] transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// SectionType 별 한글 라벨
const SECTION_LABELS: Record<string, string> = {
  hero: '히어로',
  stats: '통계',
  impact: '임팩트',
  campaigns: '캠페인',
  'donation-tiers': '후원 등급',
  team: '팀 소개',
  cta: 'CTA',
  richtext: '자유 HTML',
}

// ─── 섹션별 폼 컴포넌트 ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[80px] resize-y`
const repeatGroupCls = 'rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2'
const removeBtnCls = 'text-xs text-[var(--negative)] hover:opacity-80 transition-opacity'
const addBtnCls = 'w-full rounded-md border-2 border-dashed border-[var(--border)] py-2 text-xs text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors'

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
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">항목 {i + 1}</span>
          <button type="button" onClick={() => removeItem(i)} className={removeBtnCls}>삭제</button>
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
    <button type="button" onClick={addItem} className={addBtnCls}>
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
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">블록 {i + 1}</span>
          <button type="button" onClick={() => removeBlock(i)} className={removeBtnCls}>삭제</button>
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
    <button type="button" onClick={addBlock} className={addBtnCls}>
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
    <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--text)]">
      <input type="checkbox" checked={data.showProgress ?? true} onChange={e => onChange({ showProgress: e.target.checked })} className="accent-[var(--accent)]" />
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
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">등급 {i + 1}</span>
          <button type="button" onClick={() => removeTier(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="아이콘"><input className={inputCls} value={tier.icon ?? ''} onChange={e => updateTier(i, { icon: e.target.value })} placeholder="🌱" /></Field>
        <Field label="금액 (원)"><input type="number" className={inputCls} value={tier.amount} onChange={e => updateTier(i, { amount: Number(e.target.value) })} /></Field>
        <Field label="등급명"><input className={inputCls} value={tier.label} onChange={e => updateTier(i, { label: e.target.value })} /></Field>
        <Field label="설명"><textarea className={textareaCls} value={tier.description} onChange={e => updateTier(i, { description: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addTier} className={addBtnCls}>
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
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">멤버 {i + 1}</span>
          <button type="button" onClick={() => removeMember(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="이름"><input className={inputCls} value={member.name} onChange={e => updateMember(i, { name: e.target.value })} /></Field>
        <Field label="직책"><input className={inputCls} value={member.role} onChange={e => updateMember(i, { role: e.target.value })} /></Field>
        <Field label="소개"><textarea className={textareaCls} value={member.bio ?? ''} onChange={e => updateMember(i, { bio: e.target.value })} /></Field>
        <Field label="사진"><ImageUploadField value={member.photoUrl ?? ''} onChange={url => updateMember(i, { photoUrl: url })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addMember} className={addBtnCls}>
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
