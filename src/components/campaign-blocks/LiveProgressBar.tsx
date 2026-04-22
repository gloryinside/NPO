'use client'

import { useEffect, useState } from 'react'

interface ProgressResponse {
  raised?: number
  total?: number
  goal?: number | null
  percent?: number | null
  donors?: number | null
}

interface LiveProgressBarProps {
  slug: string
  initialRaised: number
  initialGoal: number | null
  initialDonors?: number
}

function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

/**
 * Tier S #5: 실시간 모금액 게이지.
 *
 * 초기값은 서버에서 받고, 페이지가 열려 있는 동안 60초마다 progress API를 재조회.
 * Bar는 CSS transition으로 부드럽게 채워짐.
 */
export function LiveProgressBar({
  slug,
  initialRaised,
  initialGoal,
  initialDonors,
}: LiveProgressBarProps) {
  const [raised, setRaised] = useState(initialRaised)
  const [goal, setGoal] = useState(initialGoal)
  const [donors, setDonors] = useState(initialDonors ?? 0)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/campaigns/${slug}/progress`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as ProgressResponse
        if (typeof data.raised === 'number') setRaised(data.raised)
        else if (typeof data.total === 'number') setRaised(data.total)
        if (typeof data.goal === 'number' || data.goal === null) setGoal(data.goal ?? null)
        if (typeof data.donors === 'number') setDonors(data.donors)
      } catch {
        // 네트워크 오류는 조용히 넘김
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [slug])

  const percent = goal && goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : null

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            현재 모금액
          </div>
          <div
            className="text-2xl font-bold text-[var(--text)] transition-all duration-700"
            key={raised}
          >
            {formatKRW(raised)}
          </div>
        </div>
        <div className="text-right">
          {goal != null && (
            <div className="text-xs text-[var(--muted-foreground)]">
              목표 {formatKRW(goal)}
            </div>
          )}
          {percent != null && (
            <div className="text-sm font-semibold text-[var(--accent)]">
              {percent}%
            </div>
          )}
          {donors > 0 && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {donors.toLocaleString('ko-KR')}명 참여
            </div>
          )}
        </div>
      </div>

      {goal != null && (
        <div className="h-3 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-1000 ease-out"
            style={{ width: `${percent ?? 0}%` }}
            aria-valuenow={percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      )}
    </div>
  )
}
