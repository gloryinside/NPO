'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface OwnCheerItem {
  id: string
  campaignTitle: string | null
  body: string
  anonymous: boolean
  published: boolean
  hidden: boolean
  hiddenReason: string | null
  createdAt: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR')
  } catch {
    return iso
  }
}

function statusLabel(m: OwnCheerItem): { label: string; color: string } | null {
  if (m.hidden) {
    if (m.hiddenReason === 'self_deleted') {
      return { label: '삭제됨', color: 'var(--muted-foreground)' }
    }
    return { label: '관리자 숨김', color: 'var(--negative)' }
  }
  if (!m.published) {
    return { label: '승인 대기', color: 'var(--warning)' }
  }
  return { label: '공개 중', color: 'var(--positive)' }
}

export function OwnCheerList({ items }: { items: OwnCheerItem[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function remove(id: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('응원을 삭제하시겠습니까?\n삭제된 응원은 공개 벽에서 사라집니다.')
    ) {
      return
    }
    setPending(id)
    try {
      const res = await fetch(`/api/donor/cheer/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        alert('삭제 실패')
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setPending(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] py-12 text-center">
        <p className="text-5xl mb-3">💬</p>
        <p className="text-sm text-[var(--text)]">아직 등록한 응원이 없습니다.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {items.map((m) => {
        const s = statusLabel(m)
        const canDelete = !m.hidden
        return (
          <li key={m.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span>{m.campaignTitle ?? '일반 응원'}</span>
                <span>·</span>
                <time>{formatDate(m.createdAt)}</time>
                {m.anonymous && (
                  <>
                    <span>·</span>
                    <span>익명 표시</span>
                  </>
                )}
              </div>
              {s && (
                <span
                  className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium"
                  style={{ color: s.color }}
                >
                  {s.label}
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
              {m.body}
            </p>
            {canDelete && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  disabled={pending === m.id}
                  className="rounded-md border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-1 text-xs font-medium text-[var(--negative)] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {pending === m.id ? '처리 중...' : '삭제'}
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
