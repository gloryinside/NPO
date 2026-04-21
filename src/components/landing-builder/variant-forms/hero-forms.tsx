'use client'
import type {
  HeroMinimalData, HeroSplitImageData, HeroFullscreenImageData,
  HeroFullscreenVideoData, HeroGalleryData, HeroStatsOverlayData,
} from '@/lib/landing-variants/hero-schemas'
import { ImageUploadField } from '../ImageUploadField'

// 공용 유틸 — SettingsSheet 기존 스타일 그대로 사용
const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[80px] resize-y`
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

type HeroSharedProps<T extends {
  headline: string; subheadline?: string; ctaText?: string; ctaUrl?: string;
  textAlign?: 'left' | 'center' | 'right'
}> = { data: T; onChange: (d: T) => void }

function HeroSharedFields<T extends {
  headline: string; subheadline?: string; ctaText?: string; ctaUrl?: string;
  textAlign?: 'left' | 'center' | 'right'
}>({ data, onChange }: HeroSharedProps<T>) {
  const p = (partial: Partial<T>) => onChange({ ...data, ...partial })
  return (
    <>
      <Field label="헤드라인"><input className={inputCls} value={data.headline} onChange={(e) => p({ headline: e.target.value } as Partial<T>)} /></Field>
      <Field label="서브 헤드라인"><input className={inputCls} value={data.subheadline ?? ''} onChange={(e) => p({ subheadline: e.target.value } as Partial<T>)} /></Field>
      <Field label="CTA 버튼 텍스트"><input className={inputCls} value={data.ctaText ?? ''} onChange={(e) => p({ ctaText: e.target.value } as Partial<T>)} /></Field>
      <Field label="CTA 버튼 URL"><input className={inputCls} value={data.ctaUrl ?? ''} onChange={(e) => p({ ctaUrl: e.target.value } as Partial<T>)} placeholder="#campaigns" /></Field>
      <Field label="텍스트 정렬">
        <select title="텍스트 정렬" className={inputCls} value={data.textAlign ?? 'center'}
          onChange={(e) => p({ textAlign: e.target.value as 'left' | 'center' | 'right' } as Partial<T>)}>
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
      </Field>
    </>
  )
}

export function HeroMinimalForm({ data, onChange }: { data: HeroMinimalData; onChange: (d: HeroMinimalData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} placeholder="#1a3a5c" /></Field>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

export function HeroSplitImageForm({ data, onChange }: { data: HeroSplitImageData; onChange: (d: HeroSplitImageData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="우측 이미지"><ImageUploadField value={data.rightImageUrl} onChange={(url) => onChange({ ...data, rightImageUrl: url })} /></Field>
    <Field label="이미지 비율">
      <select title="비율" className={inputCls} value={data.imageRatio}
        onChange={(e) => onChange({ ...data, imageRatio: e.target.value as '1:1' | '4:3' | '3:4' })}>
        <option value="1:1">1:1</option>
        <option value="4:3">4:3</option>
        <option value="3:4">3:4</option>
      </select>
    </Field>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

export function HeroFullscreenImageForm({ data, onChange }: { data: HeroFullscreenImageData; onChange: (d: HeroFullscreenImageData) => void }) {
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.kenBurns} onChange={(e) => onChange({ ...data, kenBurns: e.target.checked })} className="accent-[var(--accent)]" />
      Ken Burns 애니메이션
    </label>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

export function HeroFullscreenVideoForm({ data, onChange }: { data: HeroFullscreenVideoData; onChange: (d: HeroFullscreenVideoData) => void }) {
  return <>
    <Field label="비디오 URL (mp4/webm)"><input className={inputCls} value={data.videoUrl} onChange={(e) => onChange({ ...data, videoUrl: e.target.value })} placeholder="https://..." /></Field>
    <Field label="포스터 이미지 (모바일 fallback)"><ImageUploadField value={data.posterUrl} onChange={(url) => onChange({ ...data, posterUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.showMuteToggle} onChange={(e) => onChange({ ...data, showMuteToggle: e.target.checked })} className="accent-[var(--accent)]" />
      음소거 토글 버튼 표시
    </label>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

export function HeroGalleryForm({ data, onChange }: { data: HeroGalleryData; onChange: (d: HeroGalleryData) => void }) {
  function updateImg(i: number, partial: Partial<HeroGalleryData['images'][0]>) {
    onChange({ ...data, images: data.images.map((im, idx) => idx === i ? { ...im, ...partial } : im) })
  }
  function addImg() { onChange({ ...data, images: [...data.images, { url: '', alt: '' }] }) }
  function removeImg(i: number) { onChange({ ...data, images: data.images.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <Field label="슬라이드 간격 (ms, 3000~15000)">
      <input type="number" className={inputCls} min={3000} max={15000} value={data.intervalMs}
        onChange={(e) => onChange({ ...data, intervalMs: Number(e.target.value) })} />
    </Field>
    {data.images.map((img, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">이미지 {i + 1}</span>
          <button type="button" onClick={() => removeImg(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="이미지"><ImageUploadField value={img.url} onChange={(url) => updateImg(i, { url })} /></Field>
        <Field label="대체 텍스트 (alt, 필수)"><input className={inputCls} value={img.alt} onChange={(e) => updateImg(i, { alt: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addImg} className={addBtnCls}>+ 이미지 추가</button>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

export function HeroStatsOverlayForm({ data, onChange }: { data: HeroStatsOverlayData; onChange: (d: HeroStatsOverlayData) => void }) {
  function updateStat(i: number, partial: Partial<HeroStatsOverlayData['stats'][0]>) {
    onChange({ ...data, stats: data.stats.map((s, idx) => idx === i ? { ...s, ...partial } : s) })
  }
  function addStat() { onChange({ ...data, stats: [...data.stats, { value: '0', label: '항목' }] }) }
  function removeStat(i: number) { onChange({ ...data, stats: data.stats.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.kenBurns} onChange={(e) => onChange({ ...data, kenBurns: e.target.checked })} className="accent-[var(--accent)]" />
      Ken Burns 애니메이션
    </label>
    {data.stats.map((s, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">통계 {i + 1}</span>
          <button type="button" onClick={() => removeStat(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="값"><input className={inputCls} value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="1,200+" /></Field>
        <Field label="라벨"><input className={inputCls} value={s.label} onChange={(e) => updateStat(i, { label: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addStat} className={addBtnCls}>+ 통계 추가</button>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}
