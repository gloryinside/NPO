'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface AdminCheerRow {
  id: string
  campaignTitle: string | null
  memberName: string
  body: string
  anonymous: boolean
  hidden: boolean
  published: boolean
  createdAt: string
}

interface Props {
  rows: AdminCheerRow[]
}

/**
 * Phase 5-D: admin 응원 메시지 검수 리스트.
 *   - hidden 토글 → PATCH /api/admin/cheer/[id]
 *   - toggled 후 router.refresh()로 서버 재조회
 */
export function CheerModerationList({ rows }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function patch(
    row: AdminCheerRow,
    body: Record<string, unknown>
  ) {
    setPending(row.id)
    try {
      const res = await fetch(`/api/admin/cheer/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        alert('처리 실패')
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setPending(null)
    }
  }

  async function toggleHidden(row: AdminCheerRow) {
    const next = !row.hidden
    const reason =
      next && typeof window !== 'undefined'
        ? (window.prompt('숨김 사유(선택, 500자 이내):') ?? '')
        : ''
    await patch(row, { hidden: next, reason: reason || undefined })
  }

  async function approve(row: AdminCheerRow) {
    await patch(row, { published: true })
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
        등록된 응원 메시지가 없습니다.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {rows.map((r) => (
        <li key={r.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[var(--text)]">
                {r.memberName}
              </span>
              {r.anonymous && (
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                  익명 표시
                </span>
              )}
              {r.hidden && (
                <span className="rounded-full bg-[var(--negative-soft)] px-2 py-0.5 text-xs text-[var(--negative)]">
                  숨김
                </span>
              )}
              {!r.published && !r.hidden && (
                <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-xs text-[var(--warning)]">
                  승인 대기
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>{r.campaignTitle ?? '일반 응원'}</span>
              <span>·</span>
              <time>{new Date(r.createdAt).toLocaleString('ko-KR')}</time>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
            {r.body}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            {!r.published && !r.hidden && (
              <button
                type="button"
                onClick={() => approve(r)}
                disabled={pending === r.id}
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {pending === r.id ? '처리 중...' : '승인하여 공개'}
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleHidden(r)}
              disabled={pending === r.id}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${
                r.hidden
                  ? 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                  : 'border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] text-[var(--negative)]'
              }`}
            >
              {pending === r.id
                ? '처리 중...'
                : r.hidden
                  ? '숨김 해제'
                  : '숨김 처리'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
