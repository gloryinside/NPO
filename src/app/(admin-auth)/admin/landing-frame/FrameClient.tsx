'use client'

import { useEffect, useState } from 'react'
import { LandingRenderer } from '@/components/landing-builder/LandingRenderer'
import { parseToFrame, type FromFrame, type PreviewState } from '@/lib/landing/preview-protocol'
import { shownOn } from '@/lib/landing/display'
import { kstToday } from '@/lib/billing/kst'

export type FrameCampaign = {
  id: string
  title: string
  slug: string
  description: string | null
  goal_amount: number | null
  ended_at: string | null
  thumbnail_url: string | null
  raised: number
}

export function FrameClient({ campaigns, orgName }: { campaigns: FrameCampaign[]; orgName: string }) {
  const [state, setState] = useState<PreviewState | null>(null)

  useEffect(() => {
    const send = (msg: FromFrame) => window.parent.postMessage(msg, window.location.origin)
    function onMessage(e: MessageEvent) {
      // 같은 출처의 부모(편집기)가 보낸 것만 받는다
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const next = parseToFrame(e.data)
      if (next) setState(next)
    }
    window.addEventListener('message', onMessage)
    send({ kind: 'npo-landing-preview-ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // 편집기가 고른 밝기로 — 같은 출처라 저장된 관리자 테마를 따라가던 것을 명시적으로 덮는다
  useEffect(() => {
    if (state) document.documentElement.setAttribute('data-theme', state.theme)
  }, [state])

  // 선택한 섹션이 바뀌면 그 위치로 스크롤
  const selectedId = state?.selectedId ?? null
  useEffect(() => {
    if (!selectedId) return
    document.getElementById(`pv-${selectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedId])

  if (!state) return <p className="p-6 text-sm text-[var(--muted-foreground)]">미리보기를 준비하는 중…</p>

  // 공개 화면과 같은 기준(숨김·보이는 기간)
  const today = kstToday()
  const visible = [...state.sections].filter((s) => shownOn(s, today)).sort((a, b) => a.sortOrder - b.sortOrder)
  const select = (id: string) =>
    window.parent.postMessage({ kind: 'npo-landing-preview-select', id } satisfies FromFrame, window.location.origin)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* 공개 화면 상단 헤더 모양 */}
      <header className="flex h-16 items-center border-b border-[var(--border)] bg-[var(--surface)] px-6">
        <span className="text-base font-bold tracking-[-0.02em]">{orgName}</span>
        <span className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">로그인</span>
      </header>

      {visible.length === 0 && (
        <p className="py-24 text-center text-sm text-[var(--muted-foreground)]">표시할 섹션이 없습니다.</p>
      )}
      {visible.map((s) => {
        const active = s.id === selectedId
        return (
          <div
            key={s.id}
            id={`pv-${s.id}`}
            role="button"
            tabIndex={0}
            aria-label="이 섹션 편집"
            onClick={() => select(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                select(s.id)
              }
            }}
            className={`relative cursor-pointer outline outline-2 -outline-offset-2 transition-[outline-color] ${
              active ? 'outline-[var(--accent)]' : 'outline-transparent hover:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)]'
            }`}
          >
            {/* 클릭은 편집 선택용 — 섹션 안 링크로 이동하지 않게 덮개 */}
            <div className="pointer-events-none">
              <LandingRenderer sections={[s]} campaigns={campaigns} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
