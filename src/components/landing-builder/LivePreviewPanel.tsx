'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LandingSection } from '@/types/landing'
import { parseFromFrame, type ToFrame } from '@/lib/landing/preview-protocol'

interface Props {
  sections: LandingSection[]
  selectedId: string | null
  /** 미리보기에서 섹션을 눌렀을 때 — 편집기가 그 섹션을 연다 */
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * 실시간 미리보기 패널 — JobYLW 포털 빌더 방식.
 * 편집 중인 섹션을 같은 출처 postMessage로 프레임(/admin/landing-frame)에 보내 즉시 그린다
 * (예전: 2초 자동저장 후 /?draft=1 새로고침). 미리보기 클릭 → 편집기에서 그 섹션 선택.
 *
 * 기기 폭은 실제 폭으로 그린 뒤 패널에 맞춰 축소해 레이아웃이 실제와 같게 보인다.
 */
const VIEWPORTS = { desktop: 1280, tablet: 768, mobile: 390 } as const
type Viewport = keyof typeof VIEWPORTS

export function LivePreviewPanel({ sections, selectedId, onSelect, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [ready, setReady] = useState(false)
  const [boxWidth, setBoxWidth] = useState(0)

  const post = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const msg: ToFrame = { kind: 'npo-landing-preview-state', state: { sections, selectedId, theme } }
    win.postMessage(msg, window.location.origin)
  }, [sections, selectedId, theme])

  // 프레임 → 편집기: 준비 완료·섹션 선택. 같은 출처·우리 프레임이 보낸 것만
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return
      const msg = parseFromFrame(e.data)
      if (!msg) return
      if (msg.kind === 'npo-landing-preview-ready') setReady(true)
      else onSelect(msg.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSelect])

  // 편집 상태가 바뀔 때마다(그리고 프레임이 준비되면) 즉시 보낸다
  useEffect(() => {
    if (ready) post()
  }, [ready, post])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const width = VIEWPORTS[viewport]
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 1

  const seg = (active: boolean) =>
    `px-2.5 py-1 text-xs transition-colors ${active ? 'bg-[var(--surface-2)] font-semibold text-[var(--text)]' : 'text-[var(--muted-foreground)] hover:text-[var(--text)]'}`

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[-8px_0_32px_-8px_rgb(0_0_0/0.3)] sm:w-[640px] lg:w-[820px]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <div>
          <p className="eyebrow">Live Preview</p>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {ready ? '편집 내용이 바로 반영됩니다' : '미리보기 준비 중…'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="기기 폭">
            {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={viewport === v} onClick={() => setViewport(v)} className={seg(viewport === v)}>
                {v === 'desktop' ? '데스크톱' : v === 'tablet' ? '태블릿' : '모바일'}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="밝기">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className={seg(theme === t)}>
                {t === 'light' ? '라이트' : '다크'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="미리보기 닫기"
            className="rounded-lg px-2 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
      </div>

      <div ref={boxRef} className="app-canvas relative flex-1 overflow-auto">
        <div style={{ width: width * scale, margin: '0 auto' }}>
          <iframe
            ref={iframeRef}
            src="/admin/landing-frame"
            title="랜딩페이지 미리보기"
            className="origin-top-left border-0 bg-[var(--bg)]"
            style={{ width, height: `calc((100vh - 64px) / ${scale})`, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <p className="border-t border-[var(--border)] px-5 py-2 text-[11px] text-[var(--muted-foreground)]">
        미리보기에서 섹션을 누르면 편집 창이 열립니다.
      </p>
    </div>
  )
}
