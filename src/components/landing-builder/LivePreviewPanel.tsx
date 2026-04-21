'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  saveStatus: 'saved' | 'unsaved' | 'saving'
  onClose: () => void
}

/**
 * G-75: Live preview iframe 패널.
 * 에디터 우측에 `/?draft=1`을 iframe으로 로드하고,
 * saveStatus가 'saved'로 전환될 때마다 자동 reload → 최신 DB 콘텐츠 반영.
 *
 * 뷰포트 토글: desktop(1280) / tablet(768) / mobile(375)
 */
const VIEWPORTS = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
} as const
type Viewport = keyof typeof VIEWPORTS

export function LivePreviewPanel({ saveStatus, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevStatus = useRef<'saved' | 'unsaved' | 'saving'>(saveStatus)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [loadCount, setLoadCount] = useState(0)

  // saved로 전환 시 iframe reload
  useEffect(() => {
    if (prevStatus.current !== 'saved' && saveStatus === 'saved') {
      const el = iframeRef.current
      if (el) {
        el.src = el.src
        setLoadCount((n) => n + 1)
      }
    }
    prevStatus.current = saveStatus
  }, [saveStatus])

  const width = VIEWPORTS[viewport]

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[640px] lg:w-[800px] flex flex-col border-l"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '-8px 0 32px -8px rgb(0 0 0 / 0.3)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">Live Preview</p>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {saveStatus === 'saved' ? '✓ 최신 상태' : saveStatus === 'saving' ? '⏳ 저장 중…' : '○ 변경사항 있음'}
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">새로고침 {loadCount}회</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
            {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
              <button key={v} type="button"
                onClick={() => setViewport(v)}
                className="px-2 py-1 text-xs transition-colors"
                style={{
                  background: viewport === v ? 'var(--accent)' : 'var(--surface-2)',
                  color: viewport === v ? '#fff' : 'var(--muted-foreground)',
                }}>
                {v === 'desktop' ? '🖥' : v === 'tablet' ? '📱' : '📱'}
                <span className="ml-1">{v}</span>
              </button>
            ))}
          </div>
          <button type="button"
            onClick={() => {
              const el = iframeRef.current
              if (el) { el.src = el.src; setLoadCount((n) => n + 1) }
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text)] hover:border-[var(--accent)]"
            aria-label="새로고침"
            title="새로고침">
            ↻
          </button>
          <button type="button" onClick={onClose}
            aria-label="닫기"
            className="text-[var(--muted-foreground)] hover:text-[var(--text)] text-lg px-2">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--bg)] flex justify-center">
        <iframe
          ref={iframeRef}
          src="/?draft=1"
          title="Live preview"
          className="h-full border-0 bg-white"
          style={{ width, maxWidth: '100%' }}
        />
      </div>
    </div>
  )
}
