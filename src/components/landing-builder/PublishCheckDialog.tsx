'use client'
import type { AuditFinding } from '@/lib/landing/audit'
import { Modal } from '@/components/ui/layer'
import { Button } from '@/components/ui/button'

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
  return (
    <Modal
      open
      onClose={onCancel}
      size="md"
      title={`게시 전 점검: 확인할 항목이 ${findings.length}개 있습니다`}
      description="그대로 게시할 수도 있지만, 공개 페이지에 견본 콘텐츠가 보일 수 있습니다."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            돌아가서 고치기
          </Button>
          <Button type="button" onClick={onPublish}>
            그래도 게시
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
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
                <span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">고치러 가기</span>
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
    </Modal>
  )
}
