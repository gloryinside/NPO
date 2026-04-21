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
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { createSection } from '@/lib/landing-defaults'
import { SECTION_CATALOG } from '@/types/landing'
import type { LandingSection, LandingSectionType, LandingPageContent } from '@/types/landing'
import { LandingSectionSettingsSheet } from './LandingSectionSettingsSheet'

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
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="순서 변경"
      >
        ⠿
      </button>

      {/* 섹션 아이콘 + 이름 */}
      <span className="text-xl">{catalog?.emoji ?? '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{catalog?.label ?? section.type}</p>
        <p className="text-xs text-muted-foreground truncate">{catalog?.desc}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleVisible(section.id)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          title={section.isVisible ? '숨기기' : '표시'}
        >
          {section.isVisible ? '👁 표시' : '🚫 숨김'}
        </button>
        <button
          onClick={() => onEdit(section.id)}
          className="rounded-md px-2 py-1 text-xs bg-muted hover:bg-muted/80 transition-colors"
        >
          편집
        </button>
        <button
          onClick={() => onDelete(section.id)}
          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── 자동저장 (2초 debounce) ──────────────────────────────────────────────
  const scheduleSave = useCallback((updated: LandingSection[]) => {
    setSaveStatus('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await savePageContent({ schemaVersion: 1, sections: updated })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
        toast.error('자동 저장에 실패했습니다.')
      }
    }, 2000)
  }, [])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // ── 섹션 추가 ────────────────────────────────────────────────────────────
  function handleAdd(type: LandingSectionType) {
    const newSection = createSection(type, sections.length)
    const updated = [...sections, newSection]
    setSections(updated)
    setShowCatalog(false)
    setEditingId(newSection.id)
    scheduleSave(updated)
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
    // 미저장 변경사항 먼저 저장
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    try {
      await savePageContent({ schemaVersion: 1, sections })
      setSaveStatus('saved')
    } catch {
      toast.error('게시 전 저장에 실패했습니다.')
      return
    }

    setPublishing(true)
    try {
      const res = await fetch('/api/admin/org/landing/publish', { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('랜딩페이지가 게시되었습니다.')
    } catch {
      toast.error('게시에 실패했습니다.')
    } finally {
      setPublishing(false)
    }
  }

  const editingSection = sections.find(s => s.id === editingId) ?? null

  return (
    <div className="space-y-4">
      {/* ── 상단 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">랜딩페이지 편집</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {saveStatus === 'saved' && '✅ 저장됨'}
            {saveStatus === 'unsaved' && '⏳ 변경사항 있음'}
            {saveStatus === 'saving' && '💾 저장 중...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/?draft=1"
            target="_blank"
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            title="편집 중인 콘텐츠 미리보기 (관리자만)"
          >
            미리보기 →
          </a>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? '게시 중...' : '게시하기'}
          </button>
        </div>
      </div>

      {/* ── 섹션 목록 ── */}
      {sections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border py-16 text-center text-muted-foreground">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-sm">아직 섹션이 없습니다.</p>
          <p className="text-xs mt-1">아래 버튼으로 첫 섹션을 추가해보세요.</p>
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
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">추가할 섹션 선택</p>
            <button
              onClick={() => setShowCatalog(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              닫기 ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_CATALOG.map(item => (
              <button
                key={item.type}
                onClick={() => handleAdd(item.type)}
                className="flex items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCatalog(true)}
          className="w-full rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors"
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
        />
      )}
    </div>
  )
}
