'use client'
import { useEffect, useRef } from 'react'
import type { AuditFinding } from '@/lib/landing/audit'

/**
 * 게시 전 점검 결과 확인 — 경고가 있을 때만 뜬다. 게시를 막지 않고 확인 후 진행.
 * 항목을 누르면 그 섹션 편집 창을 연다.
 */
export function PublishCheckDialog({
  findings,
  onPublish,
  onOpenSection,
  onCancel,
}: {
  findings: AuditFinding[]
  onPublish: () => void
  onOpenSection: (id: string) => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="publish-check-title"
        className="animate-rise w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-hero)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">게시 전 점검</p>
        <h2 id="publish-check-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--text)]">
          확인할 항목이 {findings.length}개 있습니다
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          그대로 게시할 수도 있지만, 공개 페이지에 견본 콘텐츠가 보일 수 있습니다.
        </p>
        <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
          {findings.map((f, i) => (
            <li key={i}>
              {f.sectionId ? (
                <button
                  type="button"
                  onClick={() => onOpenSection(f.sectionId!)}
                  className="flex w-full items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-left text-sm text-[var(--text)] hover:border-[var(--warning)]"
                >
                  <span aria-hidden className="text-[var(--warning)]">⚠</span>
                  <span className="flex-1">{f.message}</span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">편집 →</span>
                </button>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--text)]">
                  <span aria-hidden className="text-[var(--warning)]">⚠</span>
                  {f.message}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--input)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            돌아가서 고치기
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-[var(--accent-hover)]"
          >
            그래도 게시
          </button>
        </div>
      </div>
    </div>
  )
}
