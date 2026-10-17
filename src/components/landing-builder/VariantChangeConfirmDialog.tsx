'use client'
import type { VariantDescriptor } from '@/lib/landing-variants/types'
import { Modal } from '@/components/ui/layer'
import { Button } from '@/components/ui/button'

interface Props {
  from: VariantDescriptor | null
  to: VariantDescriptor | null
  preserved: readonly string[]
  onConfirm: () => void
  onCancel: () => void
}

const WEIGHT_LABEL: Record<string, string> = {
  minimal: '미니멀',
  bold: '강조',
  cinematic: '시네마틱',
}

export function VariantChangeConfirmDialog({ from, to, preserved, onConfirm, onCancel }: Props) {
  if (!to) return null

  return (
    <Modal
      open
      onClose={onCancel}
      size="md"
      title="디자인 바꾸기 확인"
      description={
        <>
          전환하면 <strong className="text-[var(--warning)]">전용 필드가 초기화</strong>됩니다.
        </>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" onClick={onConfirm}>
            전환하기
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 전환 방향 */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">현재</div>
            <div className="text-sm font-semibold text-[var(--text)] truncate">{from?.label ?? '—'}</div>
            {from && (
              <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                {WEIGHT_LABEL[from.visualWeight]}
              </div>
            )}
          </div>
          <span className="text-[var(--accent)] text-xl" aria-hidden>→</span>
          <div className="rounded-md border-2 p-3 min-w-0"
            style={{ borderColor: 'var(--accent)', background: 'var(--bg)' }}>
            <div className="text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">전환 대상</div>
            <div className="text-sm font-semibold text-[var(--text)] truncate">{to.label}</div>
            <div className="text-[10px] text-[var(--accent)] mt-0.5">{WEIGHT_LABEL[to.visualWeight]}</div>
          </div>
        </div>

        {/* 유지되는 필드 */}
        <div className="rounded-md border border-[var(--positive)]/30 bg-[var(--positive)]/5 p-3">
          <div className="text-xs font-semibold text-[var(--positive)] mb-1.5">✓ 유지되는 입력</div>
          {preserved.length > 0 ? (
            <ul className="text-xs text-[var(--text)] space-y-0.5">
              {preserved.map((f) => <li key={f}>• {f}</li>)}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">없음</p>
          )}
        </div>

        {/* 설명 */}
        <p className="text-xs text-[var(--muted-foreground)]">
          {to.description}
        </p>
      </div>
    </Modal>
  )
}
