'use client'

/**
 * 기관 랜딩페이지 섹션 에디터
 *
 * RecruitFlow SectionListEditor 아키텍처를 NPO_S Supabase 패턴으로 이식.
 * - 섹션 추가/삭제/순서변경/표시토글
 * - 2초 debounce 자동저장 (page_content 전체 PATCH)
 * - 게시(publish) 버튼으로 published_content 스냅샷 생성
 * - dnd-kit 드래그앤드롭 정렬
 */

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { createSection } from '@/lib/landing-defaults'
import { SECTION_CATALOG, SHARED_FIELDS } from '@/types/landing'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { LandingSection, LandingSectionType, LandingPageContent } from '@/types/landing'
import { LandingSectionSettingsSheet } from './LandingSectionSettingsSheet'
import { VariantGalleryModal } from './VariantGalleryModal'
import { VariantChangeConfirmDialog } from './VariantChangeConfirmDialog'
import { LivePreviewPanel } from './LivePreviewPanel'
import { parseSchedule, scheduleLabel } from '@/lib/landing/display'
import { kstToday } from '@/lib/billing/kst'
import { getVariants, findVariant } from '@/lib/landing-variants'
import '@/lib/landing-variants/register-all'
import { checkMissingAssets } from '@/lib/landing-variants/asset-check'
import { nanoid } from 'nanoid'
import { auditLanding, type AuditFinding } from '@/lib/landing/audit'
import { LANDING_SCHEMA_VERSION } from '@/lib/landing/history'
import { PAGE_BUNDLES, sectionFromTemplate, sectionTemplates, sectionsFromBundle } from '@/lib/landing/templates'
import { PublishCheckDialog } from './PublishCheckDialog'
import { LandingHistoryPanel } from './LandingHistoryPanel'
import { LandingAiPanel } from './LandingAiPanel'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Props {
  initialPageContent: LandingPageContent
  /** 한 번이라도 게시했는지 — "초안 변경 버리기"는 게시본이 있어야 가능 */
  initialHasPublished?: boolean
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

async function savePageContent(pageContent: LandingPageContent) {
  const res = await fetch('/api/admin/org/landing', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageContent }),
  })
  if (!res.ok) throw new Error('저장 실패')
}

// ─── SortableRow ──────────────────────────────────────────────────────────────

function SortableRow({
  section,
  selected,
  onEdit,
  onToggleVisible,
  onDuplicate,
  onDelete,
}: {
  section: LandingSection
  selected: boolean
  onEdit: (id: string) => void
  onToggleVisible: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const catalog = SECTION_CATALOG.find(c => c.type === section.type)
  // G-51: 필수 에셋 미입력 시 경고 배지
  const assetCheck = checkMissingAssets(section)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border bg-[var(--surface)] px-4 py-3 shadow-card transition-colors ${
        selected ? 'border-[var(--text)]' : 'border-[var(--border)]'
      } ${section.isVisible ? '' : 'opacity-60'}`}
    >
      {/* 드래그 핸들 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-[var(--muted-foreground)] hover:text-[var(--text)] active:cursor-grabbing select-none"
        aria-label="순서 변경"
      >
        ⠿
      </button>

      {/* 섹션 아이콘 + 이름 */}
      <span className="text-xl">{catalog?.emoji ?? '📄'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--text)] truncate">{catalog?.label ?? section.type}</p>
          {(() => {
            const label = scheduleLabel(parseSchedule((section.data as Record<string, unknown>)?.schedule), kstToday())
            return label ? (
              <span className="whitespace-nowrap rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">
                {label}
              </span>
            ) : null
          })()}
          {assetCheck.missing && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30"
              title={`필수 에셋 미입력: ${assetCheck.fields.join(', ')}`}
            >
              ⚠️ 에셋 필요
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {assetCheck.missing
            ? `${assetCheck.fields.join(', ')} 입력 필요`
            : catalog?.desc}
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleVisible(section.id)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--text)] transition-colors"
          title={section.isVisible ? '숨기기' : '표시'}
        >
          {section.isVisible ? '표시' : '숨김'}
        </button>
        <button
          type="button"
          onClick={() => onEdit(section.id)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text)] hover:opacity-80 transition-opacity"
        >
          편집
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(section.id)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text)] hover:opacity-80 transition-opacity"
          title="바로 아래에 복제"
        >
          복제
        </button>
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          className="rounded-md border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-2.5 py-1 text-xs text-[var(--negative)] hover:opacity-80 transition-opacity"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

// ─── 메인 에디터 ──────────────────────────────────────────────────────────────

export function LandingSectionEditor({ initialPageContent, initialHasPublished = false }: Props) {
  const [sections, setSections] = useState<LandingSection[]>(
    initialPageContent.sections ?? []
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const [publishing, setPublishing] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [pickingVariantFor, setPickingVariantFor] = useState<LandingSectionType | null>(null)
  const [variantChangeFor, setVariantChangeFor] = useState<string | null>(null)
  // G-52: confirm() → 커스텀 다이얼로그로
  const [pendingVariantChange, setPendingVariantChange] = useState<{ sectionId: string; newVariantId: string } | null>(null)
  const confirm = useConfirm()
  // G-75: Live preview iframe
  const [showPreview, setShowPreview] = useState(false)
  const [hasPublished, setHasPublished] = useState(initialHasPublished)
  // 게시 전 점검 결과(경고가 있을 때만 확인 창)
  const [auditFindings, setAuditFindings] = useState<AuditFinding[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusRef = useRef<'saved' | 'unsaved' | 'saving'>('saved')

  // dnd-kit 자동 id는 서버·클라이언트 카운터가 달라 hydration 불일치 → 고정 id
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── 자동저장 (2초 debounce) ──────────────────────────────────────────────
  const scheduleSave = useCallback((updated: LandingSection[]) => {
    saveStatusRef.current = 'unsaved'
    setSaveStatus('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      saveStatusRef.current = 'saving'
      setSaveStatus('saving')
      try {
        await savePageContent({ schemaVersion: LANDING_SCHEMA_VERSION, sections: updated })
        saveStatusRef.current = 'saved'
        setSaveStatus('saved')
      } catch {
        saveStatusRef.current = 'unsaved'
        setSaveStatus('unsaved')
        toast.error('자동 저장에 실패했습니다.')
      }
    }, 2000)
  }, [])

  // G-38: 미저장 변경사항이 있을 때 페이지 이탈 경고
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatusRef.current !== 'saved') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── 섹션 추가 (Step 1: 타입 선택) ────────────────────────────────────────
  function handlePickType(type: LandingSectionType) {
    // Phase A: variants 등록된 type은 갤러리로, 아니면 기본 variant로 바로 추가
    if (getVariants(type).length > 0) {
      setShowCatalog(false)
      setPickingVariantFor(type)
    } else {
      handleAddWithVariant(type, null)
    }
  }

  // ── 섹션 추가 (Step 2: variant 선택 or 기본값) ───────────────────────────
  function handleAddWithVariant(type: LandingSectionType, variantId: string | null) {
    const newSection = createSection(type, sections.length)
    if (variantId) {
      newSection.variant = variantId
      const variant = getVariants(type).find((v) => v.id === variantId)
      if (variant) newSection.data = variant.defaultData() as typeof newSection.data
    }
    const updated = [...sections, newSection]
    setSections(updated)
    setShowCatalog(false)
    setPickingVariantFor(null)
    setEditingId(newSection.id)
    scheduleSave(updated)
  }

  // ── Variant 전환 (기존 섹션의 variant 바꾸기) ────────────────────────────
  function handleVariantChange(sectionId: string, newVariantId: string) {
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    const variant = getVariants(section.type).find((v) => v.id === newVariantId)
    if (!variant) return

    const shared = SHARED_FIELDS[section.type]
    const newDefault = variant.defaultData() as Record<string, unknown>
    const oldData = section.data as unknown as Record<string, unknown>
    const merged: Record<string, unknown> = { ...newDefault }
    for (const key of shared) {
      if (oldData[key] !== undefined) merged[key] = oldData[key]
    }

    const updated = sections.map((s) =>
      s.id === sectionId
        ? { ...s, variant: newVariantId, data: merged as typeof s.data }
        : s
    )
    setSections(updated)
    scheduleSave(updated)
    setVariantChangeFor(null)
  }

  // ── 섹션 삭제 ────────────────────────────────────────────────────────────
  // 공용 확인창(useConfirm) — 브라우저 confirm()은 쓰지 않는다(G-52)
  async function handleDelete(id: string) {
    const target = sections.find((s) => s.id === id)
    const label = SECTION_CATALOG.find((c) => c.type === target?.type)?.label ?? '이'
    const ok = await confirm({
      title: `'${label}' 섹션을 지울까요?`,
      description: '편집 중인 초안에서만 지워져요. 다시 게시하기 전까지 공개 페이지에는 그대로 보입니다.',
      confirmText: '섹션 지우기',
      tone: 'danger',
    })
    if (!ok) return
    const updated = sections.filter(s => s.id !== id).map((s, i) => ({ ...s, sortOrder: i }))
    setSections(updated)
    scheduleSave(updated)
  }

  // ── 섹션 복제 (바로 아래에 삽입) ─────────────────────────────────────────
  function handleDuplicate(id: string) {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx === -1) return
    if (sections.length >= 20) {
      toast.error('섹션은 최대 20개까지 추가할 수 있습니다.')
      return
    }
    const copy: LandingSection = {
      ...sections[idx],
      id: nanoid(),
      data: structuredClone(sections[idx].data),
    }
    const updated = [...sections.slice(0, idx + 1), copy, ...sections.slice(idx + 1)].map((s, i) => ({
      ...s,
      sortOrder: i,
    }))
    setSections(updated)
    setEditingId(copy.id)
    scheduleSave(updated)
  }

  // ── 표시/숨김 토글 ───────────────────────────────────────────────────────
  function handleToggleVisible(id: string) {
    const updated = sections.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s)
    setSections(updated)
    scheduleSave(updated)
  }

  // ── 섹션 데이터 저장 (설정 시트에서 호출) ────────────────────────────────
  function handleSaveSection(id: string, data: LandingSection['data']) {
    const updated = sections.map(s => s.id === id ? { ...s, data } : s)
    setSections(updated)
    scheduleSave(updated)
    toast.success('저장되었습니다.')
  }

  // ── 드래그앤드롭 ─────────────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex(s => s.id === active.id)
    const newIdx = sections.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({ ...s, sortOrder: i }))
    setSections(reordered)
    scheduleSave(reordered)
  }

  // ── 게시 ─────────────────────────────────────────────────────────────────
  // 게시 전 점검 — 경고가 있으면 확인 창, 없으면 바로 게시
  function requestPublish() {
    const findings = auditLanding(sections)
    if (findings.length > 0) setAuditFindings(findings)
    else void handlePublish()
  }

  async function handlePublish() {
    setAuditFindings(null)
    // G-43: debounce 취소 후 sections를 body에 포함해 단일 요청으로 저장+게시
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveStatusRef.current = 'saving'
    setSaveStatus('saving')
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/org/landing/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { historyRecorded?: boolean }
      saveStatusRef.current = 'saved'
      setSaveStatus('saved')
      setHasPublished(true)
      toast.success('랜딩페이지가 게시되었습니다.')
      if (json.historyRecorded === false) {
        toast.warning('게시는 되었지만 이력을 남기지 못했습니다. (게시 이력 DB 적용 필요)')
      }
    } catch {
      saveStatusRef.current = 'unsaved'
      setSaveStatus('unsaved')
      toast.error('게시에 실패했습니다.')
    } finally {
      setPublishing(false)
    }
  }

  // ── 이력 복원·초안 폐기 → 서버가 이미 초안을 바꿨으므로 목록만 교체 ──────
  function handleRestored(content: LandingPageContent) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSections(content.sections ?? [])
    setEditingId(null)
    saveStatusRef.current = 'saved'
    setSaveStatus('saved')
  }

  const editingSection = sections.find(s => s.id === editingId) ?? null

  return (
    <div className="space-y-4">
      {/* ── 툴바: 저장 상태 + 미리보기 + 게시 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background:
                saveStatus === 'saved'
                  ? 'var(--positive)'
                  : saveStatus === 'saving'
                    ? 'var(--warning)'
                    : 'var(--muted-foreground)',
            }}
          />
          <span className="text-[var(--muted-foreground)]">
            {saveStatus === 'saved' && '저장됨'}
            {saveStatus === 'unsaved' && '변경사항이 있습니다'}
            {saveStatus === 'saving' && '저장 중…'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-80 transition-opacity"
            title="편집 중인 콘텐츠 미리보기 (관리자만)"
          >
            {showPreview ? '미리보기 닫기' : '미리보기'}
          </button>
          <a
            href="/?draft=1"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
            title="새 탭에서 열기"
          >
            ↗
          </a>
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-80 transition-opacity"
            title="기관 소개로 섹션 문구 초안 만들기"
          >
            AI 초안
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-80 transition-opacity"
            title="게시 이력·되돌리기"
          >
            이력
          </button>
          <button
            type="button"
            onClick={requestPublish}
            disabled={publishing}
            className="rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            {publishing ? '게시 중…' : '게시하기'}
          </button>
        </div>
      </div>

      {/* ── 섹션 목록 ── */}
      {sections.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface)] py-12 text-center space-y-4 px-4">
          <p className="text-3xl">📄</p>
          <p className="text-sm text-[var(--text)]">아직 섹션이 없습니다.</p>
          <p className="text-xs text-[var(--muted-foreground)]">페이지 묶음으로 빠르게 시작하거나, 아래 버튼으로 직접 섹션을 추가해보세요.</p>
          {/* 페이지 묶음 — 후원 페이지용 문구가 채워진 섹션 세트(lib/landing/templates) */}
          <div className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-3">
            {PAGE_BUNDLES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  const added = sectionsFromBundle(b.id, kstToday())
                  setSections(added)
                  scheduleSave(added)
                  setEditingId(added[0]?.id ?? null)
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-card transition-colors hover:border-[var(--accent)]"
              >
                <p className="text-sm font-semibold text-[var(--text)]">{b.name}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{b.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map(section => (
                <SortableRow
                  key={section.id}
                  section={section}
                  selected={section.id === editingId}
                  onEdit={setEditingId}
                  onToggleVisible={handleToggleVisible}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── 섹션 추가 ── */}
      {showCatalog ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text)]">추가할 섹션 선택</p>
            <button
              type="button"
              onClick={() => setShowCatalog(false)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
            >
              닫기 ✕
            </button>
          </div>
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">템플릿에서 시작 — 문구가 채워진 섹션</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sectionTemplates(kstToday()).map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => {
                  if (sections.length >= 20) {
                    toast.error('섹션은 최대 20개까지 추가할 수 있습니다.')
                    return
                  }
                  const added = sectionFromTemplate(t, sections.length)
                  const updated = [...sections, added]
                  setSections(updated)
                  setShowCatalog(false)
                  setEditingId(added.id)
                  scheduleSave(updated)
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:border-[var(--accent)]"
              >
                <p className="text-sm font-medium text-[var(--text)]">
                  <span className="mr-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">{t.category}</span>
                  {t.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{t.description}</p>
              </button>
            ))}
          </div>
          <p className="pt-2 text-xs font-semibold text-[var(--muted-foreground)]">빈 섹션 — 형태를 골라 직접 작성</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTION_CATALOG.map(item => (
              <button
                type="button"
                key={item.type}
                onClick={() => handlePickType(item.type)}
                className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{item.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCatalog(true)}
          className="w-full rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface)] py-3 text-sm text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          + 섹션 추가
        </button>
      )}

      {/* ── 설정 시트 ── */}
      {editingSection && (
        <LandingSectionSettingsSheet
          // 섹션이 바뀌면 시트를 새로 마운트 — 안 그러면 이전 섹션의 편집값이 남아 다른 섹션에 저장된다
          key={editingSection.id}
          section={editingSection}
          open={!!editingId}
          onClose={() => setEditingId(null)}
          onSave={handleSaveSection}
          onRequestVariantChange={() => setVariantChangeFor(editingSection.id)}
        />
      )}

      {/* ── Variant 갤러리 (섹션 추가) ── */}
      {pickingVariantFor && (
        <VariantGalleryModal
          type={pickingVariantFor}
          onSelect={(variantId) => handleAddWithVariant(pickingVariantFor, variantId)}
          onClose={() => setPickingVariantFor(null)}
        />
      )}

      {/* ── Variant 전환 (기존 섹션) ── */}
      {variantChangeFor && !pendingVariantChange && (() => {
        const target = sections.find((s) => s.id === variantChangeFor)
        if (!target) return null
        return (
          <VariantGalleryModal
            type={target.type}
            currentVariantId={target.variant}
            onSelect={(variantId) => {
              if (variantId === target.variant) {
                setVariantChangeFor(null)
                return
              }
              // G-52: confirm() 대신 커스텀 다이얼로그
              setPendingVariantChange({ sectionId: variantChangeFor, newVariantId: variantId })
            }}
            onClose={() => setVariantChangeFor(null)}
          />
        )
      })()}

      {/* ── G-52: Variant 전환 확인 커스텀 다이얼로그 ── */}
      {pendingVariantChange && (() => {
        const target = sections.find((s) => s.id === pendingVariantChange.sectionId)
        if (!target) return null
        const fromDesc = findVariant(target.variant) ?? null
        const toDesc = findVariant(pendingVariantChange.newVariantId) ?? null
        return (
          <VariantChangeConfirmDialog
            from={fromDesc}
            to={toDesc}
            preserved={SHARED_FIELDS[target.type]}
            onConfirm={() => {
              handleVariantChange(pendingVariantChange.sectionId, pendingVariantChange.newVariantId)
              setPendingVariantChange(null)
            }}
            onCancel={() => setPendingVariantChange(null)}
          />
        )
      })()}


      {/* ── G-75: Live preview iframe 패널 ── */}
      {showPreview && (
        <LivePreviewPanel
          sections={sections}
          selectedId={editingId}
          onSelect={setEditingId}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── 게시 전 점검 ── */}
      {auditFindings && (
        <PublishCheckDialog
          findings={auditFindings}
          onPublish={() => void handlePublish()}
          onOpenSection={(id) => {
            setAuditFindings(null)
            setEditingId(id)
          }}
          onCancel={() => setAuditFindings(null)}
        />
      )}

      {/* ── AI 초안 ── */}
      {showAi && (
        <LandingAiPanel
          onClose={() => setShowAi(false)}
          onApply={(added, mode) => {
            const base = mode === 'replace' ? [] : sections
            const room = 20 - base.length
            if (room <= 0) {
              toast.error('섹션은 최대 20개까지 추가할 수 있습니다.')
              return
            }
            const updated = [...base, ...added.slice(0, room)].map((s, i) => ({ ...s, sortOrder: i }))
            setSections(updated)
            scheduleSave(updated)
            setShowAi(false)
            setEditingId(null)
            toast.success(mode === 'replace' ? 'AI 초안으로 교체했습니다. 확인 후 게시하세요.' : 'AI 초안 섹션을 추가했습니다.')
          }}
        />
      )}

      {/* ── 게시 이력 ── */}
      {showHistory && (
        <LandingHistoryPanel
          hasPublished={hasPublished}
          onRestored={handleRestored}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
