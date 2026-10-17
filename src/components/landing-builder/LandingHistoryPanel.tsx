'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { HistoryEntry } from '@/lib/landing/history'
import type { LandingPageContent } from '@/types/landing'

/**
 * 게시 이력 패널 — 이전 게시본을 초안으로 복원하거나, 게시 후 바꾼 초안을 버린다.
 * 복원·폐기 모두 공개 페이지는 그대로다. 미리보기로 확인한 뒤 다시 게시해야 반영된다.
 */
export function LandingHistoryPanel({
  hasPublished,
  onRestored,
  onClose,
}: {
  hasPublished: boolean
  /** 초안이 바뀌었을 때 — 편집기가 섹션 목록을 교체한다 */
  onRestored: (content: LandingPageContent, how: 'restore' | 'discard') => void
  onClose: () => void
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/org/landing/history')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? '이력을 불러오지 못했습니다.')
        return j.entries as HistoryEntry[]
      })
      .then((e) => alive && setEntries(e))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  async function act(url: string, key: string, how: 'restore' | 'discard') {
    setBusy(key)
    try {
      const r = await fetch(url, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? '실패했습니다.')
      onRestored(j.pageContent as LandingPageContent, how)
      toast.success(how === 'restore' ? '선택한 게시본을 초안으로 불러왔습니다. 확인 후 게시하세요.' : '초안을 현재 게시본으로 되돌렸습니다.')
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
      setConfirmId(null)
    }
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-history-title"
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="eyebrow">Publish History</p>
            <h2 id="landing-history-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--text)]">
              게시 이력
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              복원은 초안만 바꿉니다. 공개 페이지는 다시 게시할 때 바뀝니다.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]">
            ✕
          </button>
        </div>

        {hasPublished && (
          <div className="border-b border-[var(--border)] px-5 py-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act('/api/admin/org/landing/discard', 'discard', 'discard')}
              className="w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {busy === 'discard' ? '되돌리는 중…' : '초안 변경 버리고 현재 게시본으로'}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
          {!error && entries === null && <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>}
          {entries?.length === 0 && (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">아직 게시 이력이 없습니다.</p>
          )}
          <ol className="space-y-2">
            {entries?.map((e, i) => (
              <li key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {fmt(e.createdAt)}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                          현재 게시본
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                      섹션 {e.sectionCount}개{e.publishedByEmail ? ` · ${e.publishedByEmail}` : ''}
                    </p>
                  </div>
                  {confirmId === e.id ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act(`/api/admin/org/landing/history/${e.id}/restore`, e.id, 'restore')}
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {busy === e.id ? '복원 중…' : '초안으로 복원'}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]">
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(e.id)}
                      className="shrink-0 rounded-lg border border-[var(--input)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
                    >
                      불러오기
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  )
}
