'use client'
import type { VariantDescriptor } from '@/lib/landing-variants/types'

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog" aria-modal aria-labelledby="variant-change-title">
      <div className="w-full max-w-md rounded-lg border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-hero)' }}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 id="variant-change-title" className="text-base font-semibold text-[var(--text)]">
            Variant 전환 확인
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            전환하면 <strong className="text-[var(--warning)]">전용 필드가 초기화</strong>됩니다.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
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

        <div className="flex gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] py-2 text-sm text-[var(--text)] hover:opacity-80 transition-opacity">
            취소
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}>
            전환하기
          </button>
        </div>
      </div>
    </div>
  )
}
