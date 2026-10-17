'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { HistoryEntry } from '@/lib/landing/history'
import type { LandingPageContent } from '@/types/landing'
import { Modal } from '@/components/ui/layer'
import { Button } from '@/components/ui/button'

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
    <Modal
      open
      onClose={onClose}
      size="md"
      title="게시 이력"
      description="복원은 초안만 바꿉니다. 공개 페이지는 다시 게시할 때 바뀝니다."
    >
      {hasPublished && (
        <div className="mb-4 border-b border-[var(--border)] pb-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy !== null}
            loading={busy === 'discard'}
            onClick={() => act('/api/admin/org/landing/discard', 'discard', 'discard')}
          >
            {busy === 'discard' ? '되돌리는 중…' : '초안 변경 버리고 현재 게시본으로'}
          </Button>
        </div>
      )}

      <div>
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
    </Modal>
  )
}
