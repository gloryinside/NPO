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

import { useState, useEffect, useCallback, useRef } from 'react'
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
import type { LandingSection, LandingSectionType, LandingPageContent } from '@/types/landing'
import { LandingSectionSettingsSheet } from './LandingSectionSettingsSheet'
import { VariantGalleryModal } from './VariantGalleryModal'
import { getVariants } from '@/lib/landing-variants'
import '@/lib/landing-variants/register-all'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Props {
  initialPageContent: LandingPageContent
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
  onEdit,
  onToggleVisible,
  onDelete,
}: {
  section: LandingSection
  onEdit: (id: string) => void
  onToggleVisible: (id: string) => void
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
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
        <p className="text-sm font-medium text-[var(--text)] truncate">{catalog?.label ?? section.type}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">{catalog?.desc}</p>
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

export function LandingSectionEditor({ initialPageContent }: Props) {
  const [sections, setSections] = useState<LandingSection[]>(
    initialPageContent.sections ?? []
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const [publishing, setPublishing] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [pickingVariantFor, setPickingVariantFor] = useState<LandingSectionType | null>(null)
  const [variantChangeFor, setVariantChangeFor] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusRef = useRef<'saved' | 'unsaved' | 'saving'>('saved')

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
        await savePageContent({ schemaVersion: 1, sections: updated })
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
  function handleDelete(id: string) {
    if (!confirm('이 섹션을 삭제할까요?')) return
    const updated = sections.filter(s => s.id !== id).map((s, i) => ({ ...s, sortOrder: i }))
    setSections(updated)
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
  async function handlePublish() {
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
      saveStatusRef.current = 'saved'
      setSaveStatus('saved')
      toast.success('랜딩페이지가 게시되었습니다.')
    } catch {
      saveStatusRef.current = 'unsaved'
      setSaveStatus('unsaved')
      toast.error('게시에 실패했습니다.')
    } finally {
      setPublishing(false)
    }
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
          <a
            href="/?draft=1"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-80 transition-opacity"
            title="편집 중인 콘텐츠 미리보기 (관리자만)"
          >
            미리보기 →
          </a>
          <button
            type="button"
            onClick={handlePublish}
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
          <p className="text-xs text-[var(--muted-foreground)]">추천 템플릿으로 빠르게 시작하거나, 아래 버튼으로 직접 섹션을 추가해보세요.</p>
          {/* G-44: 추천 템플릿 (히어로 → 캠페인 → CTA) */}
          <button
            type="button"
            onClick={() => {
              const template: Array<{ type: LandingSectionType; variant?: string }> = [
                { type: 'hero', variant: 'hero-fullscreen-image' },
                { type: 'campaigns' },
                { type: 'cta', variant: 'cta-gradient' },
              ]
              const added = template.map(({ type, variant }, i) => {
                const s = createSection(type, i)
                if (variant) {
                  s.variant = variant
                  const descriptor = getVariants(type).find((v) => v.id === variant)
                  if (descriptor) s.data = descriptor.defaultData() as typeof s.data
                }
                return s
              })
              setSections(added)
              scheduleSave(added)
              setEditingId(added[0].id)
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            🚀 추천 템플릿으로 시작하기
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map(section => (
                <SortableRow
                  key={section.id}
                  section={section}
                  onEdit={setEditingId}
                  onToggleVisible={handleToggleVisible}
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
      {variantChangeFor && (() => {
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
              const shared = SHARED_FIELDS[target.type]
              if (!confirm(
                `Variant를 바꾸면 전용 입력값이 초기화됩니다.\n` +
                `유지되는 필드: ${shared.join(', ')}\n` +
                `계속하시겠습니까?`
              )) {
                return
              }
              handleVariantChange(variantChangeFor, variantId)
            }}
            onClose={() => setVariantChangeFor(null)}
          />
        )
      })()}
    </div>
  )
}
