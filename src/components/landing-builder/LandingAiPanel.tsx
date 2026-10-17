'use client'
import { useState } from 'react'
import type { LandingSection } from '@/types/landing'
import { SECTION_CATALOG } from '@/types/landing'

/**
 * AI 초안 패널 — 기관 소개를 쓰면 템플릿 기반 섹션 문구를 만들어 미리 보여 준다.
 * 저장하지 않는다. "끝에 추가"·"전체 교체"를 눌러야 편집 중 초안에 들어가고, 이후 평소처럼 자동저장·게시.
 */
export function LandingAiPanel({
  onApply,
  onClose,
}: {
  onApply: (sections: LandingSection[], mode: 'append' | 'replace') => void
  onClose: () => void
}) {
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sections: LandingSection[]; dropped: number } | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  async function generate() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/org/landing/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'AI 초안을 만들지 못했습니다.')
      setResult(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = (s: LandingSection) => SECTION_CATALOG.find((c) => c.type === s.type)?.label ?? s.type
  const headlineOf = (s: LandingSection) => {
    const d = s.data as Record<string, unknown>
    return String(d.headline ?? d.title ?? '')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-ai-title"
        className="animate-rise w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-hero)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">AI Draft</p>
        <h2 id="landing-ai-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--text)]">AI로 랜딩 초안 만들기</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          기관 소개를 적으면 후원 페이지 섹션과 문구를 제안해요. 숫자·통계는 지어내지 않고, 링크·이미지는 바꾸지 않아요.
        </p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={1500}
          rows={5}
          placeholder="예: 우리 재단은 2015년부터 지역 독거 어르신께 도시락을 전달합니다. 올해는 겨울 난방비 지원 캠페인을 진행하며 정기후원자를 모집합니다."
          className="mt-4 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]"
        />
        <div className="mt-1 text-right text-[11px] text-[var(--muted-2)]">{brief.length}/1500</div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-sm text-[var(--negative)]">{error}</p>}

        {result && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--text)]">
              제안 {result.sections.length}개 섹션{result.dropped ? ` (검증 실패로 ${result.dropped}개 제외)` : ''}
            </p>
            <ol className="max-h-56 space-y-1.5 overflow-y-auto">
              {result.sections.map((s, i) => (
                <li key={s.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                  <span className="mr-2 text-xs font-semibold text-[var(--muted-foreground)]">{i + 1}. {label(s)}</span>
                  <span className="text-[var(--text)]">{headlineOf(s)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--input)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">
            닫기
          </button>
          {!result ? (
            <button
              type="button"
              disabled={busy || brief.trim().length < 10}
              onClick={generate}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {busy ? '만드는 중…' : '초안 만들기'}
            </button>
          ) : result.sections.length > 0 ? (
            <>
              {confirmReplace ? (
                <button
                  type="button"
                  onClick={() => onApply(result.sections, 'replace')}
                  className="rounded-xl bg-[var(--negative)] px-4 py-2 text-sm font-semibold text-white"
                >
                  지금 섹션을 모두 지우고 교체
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmReplace(true)} className="rounded-xl border border-[var(--input)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">
                  전체 교체…
                </button>
              )}
              <button
                type="button"
                onClick={() => onApply(result.sections, 'append')}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-[var(--accent-hover)]"
              >
                끝에 추가
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
