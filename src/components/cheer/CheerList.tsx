'use client'

import { useState } from 'react'
import type { CheerMessage } from '@/lib/cheer/messages'

interface Props {
  initialMessages: CheerMessage[]
  initialNextCursor: string | null
  campaignId: string | null
  pageSize?: number
}

/**
 * Phase 7-E / G-110: 응원 메시지 리스트 + "더 보기" 버튼.
 * 서버에서 받은 초기 50건을 state의 seed로만 쓰고, 이후 append는 클라이언트 관리.
 * 부모 re-render 시에도 state가 유지돼 사용자가 로드한 추가분이 사라지지 않는다.
 */
export function CheerList({
  initialMessages,
  initialNextCursor,
  campaignId,
  pageSize = 50,
}: Props) {
  const [messages, setMessages] = useState<CheerMessage[]>(initialMessages)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMore = async () => {
    if (!cursor || loading) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (campaignId) params.set('campaignId', campaignId)
      params.set('before', cursor)
      params.set('limit', String(pageSize))

      const res = await fetch(`/api/cheer?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      const json = (await res.json()) as {
        messages: CheerMessage[]
        nextCursor: string | null
      }
      setMessages((prev) => [...prev, ...json.messages])
      setCursor(json.nextCursor)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (messages.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] py-10 text-center">
        <p className="text-sm text-[var(--text)]">
          아직 등록된 응원 메시지가 없습니다.
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          첫 번째 응원을 남겨주세요.
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="mt-6 space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--text)]">
                {m.displayName}
              </span>
              <time className="text-xs text-[var(--muted-foreground)]">
                {formatRelative(m.createdAt)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
              {m.body}
            </p>
          </li>
        ))}
      </ul>

      {cursor && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '불러오는 중…' : '더 보기'}
          </button>
          {error && (
            <p role="alert" className="text-xs text-[var(--danger-text)]">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const diff = now - t
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return iso
  }
}
