'use client'

import { useEffect, useState } from 'react'

interface Donor {
  masked_name: string
  amount: number
  at: string | null
}

interface RecentDonorFeedProps {
  slug: string
  limit?: number
  variant?: 'list' | 'toast'
}

function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 60_000) return '방금 전'
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}분 전`
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}시간 전`
  return `${Math.round(diffMs / 86_400_000)}일 전`
}

/**
 * Tier S #5: 최근 후원자 피드.
 *
 * list: 리스트 형태로 N명 표시 (기본)
 * toast: 하단 팝업형 (social proof) — 자동으로 목록을 순환하며 5초씩 표시
 */
export function RecentDonorFeed({
  slug,
  limit = 10,
  variant = 'list',
}: RecentDonorFeedProps) {
  const [donors, setDonors] = useState<Donor[]>([])
  const [toastIdx, setToastIdx] = useState(0)

  async function load() {
    try {
      const res = await fetch(
        `/api/public/campaigns/${slug}/recent-donors?limit=${limit}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const data = (await res.json()) as { donors?: Donor[] }
      setDonors(data.donors ?? [])
    } catch {
      // skip
    }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    if (variant !== 'toast' || donors.length === 0) return
    const iv = setInterval(() => {
      setToastIdx((i) => (i + 1) % donors.length)
    }, 5000)
    return () => clearInterval(iv)
  }, [variant, donors.length])

  if (donors.length === 0) return null

  if (variant === 'toast') {
    const d = donors[toastIdx]
    return (
      <div
        aria-live="polite"
        className="fixed bottom-6 left-6 z-40 max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg"
      >
        <div className="text-xs text-[var(--muted-foreground)]">
          {relativeTime(d.at)}
        </div>
        <div className="mt-1 text-sm text-[var(--text)]">
          <span className="font-medium">{d.masked_name}</span>
          님이{' '}
          <span className="font-semibold text-[var(--accent)]">
            {formatKRW(d.amount)}
          </span>{' '}
          후원하셨습니다
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
        최근 후원 내역
      </h3>
      <ul className="space-y-2">
        {donors.map((d, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-[var(--text)] truncate">
                {d.masked_name}
              </span>
              <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                {relativeTime(d.at)}
              </span>
            </div>
            <span className="font-semibold text-[var(--accent)] shrink-0">
              {formatKRW(d.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
