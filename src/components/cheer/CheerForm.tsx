'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  campaignId: string | null
  loggedIn: boolean
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '응원하려면 후원자 로그인이 필요합니다.',
  empty_body: '내용을 입력해주세요.',
  too_long: '500자 이내로 입력해주세요.',
  rate_limited: '너무 자주 등록했습니다. 잠시 후 다시 시도해주세요.',
  insert_failed: '등록 중 오류가 발생했습니다.',
  campaign_not_found: '대상 캠페인을 찾을 수 없습니다.',
  profanity_blocked:
    '부적절한 표현이 포함되어 있어 등록할 수 없습니다. 다른 문장으로 남겨주세요.',
}

const MAX_LEN = 500

/**
 * Phase 5-D: 응원 폼.
 *   - 비로그인 시 로그인 유도
 *   - 로그인 시 textarea + 익명 체크 + 전송
 *   - 성공 시 router.refresh()로 서버 데이터 재조회
 */
export function CheerForm({ campaignId, loggedIn }: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMark, setSuccessMark] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  if (!loggedIn) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-center">
        <p className="text-sm text-[var(--text)]">
          후원자 로그인 후 응원 메시지를 남길 수 있습니다.
        </p>
        <a
          href="/donor/login"
          className="mt-3 inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90"
        >
          로그인
        </a>
      </div>
    )
  }

  const remaining = MAX_LEN - body.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = body.trim()
    if (trimmed.length === 0) {
      setError(ERROR_MESSAGES.empty_body)
      return
    }
    if (trimmed.length > MAX_LEN) {
      setError(ERROR_MESSAGES.too_long)
      return
    }
    setSubmitting(true)
    setPendingMessage(null)
    try {
      const res = await fetch('/api/cheer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          body: trimmed,
          anonymous,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: true; pendingReview?: boolean; error?: string }
        | null
      if (!res.ok || !data || !('ok' in data)) {
        const code = data?.error ?? 'insert_failed'
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.insert_failed)
        return
      }
      setBody('')
      setSuccessMark(true)
      setTimeout(() => setSuccessMark(false), 2000)
      if (data.pendingReview) {
        setPendingMessage(
          '응원이 접수되었습니다. 관리자 검토 후 공개됩니다.'
        )
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
    >
      <label htmlFor="cheer-body" className="sr-only">
        응원 메시지
      </label>
      <textarea
        id="cheer-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_LEN}
        rows={3}
        placeholder="따뜻한 응원 한 줄을 남겨주세요."
        className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        disabled={submitting}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            disabled={submitting}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          익명으로 표시 (김○○)
        </label>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${
              remaining < 50
                ? 'text-[var(--warning)]'
                : 'text-[var(--muted-foreground)]'
            }`}
            aria-live="polite"
          >
            {remaining}자 남음
          </span>
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '등록 중...' : successMark ? '✓ 등록됨' : '응원 남기기'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-[var(--negative)]" role="alert">
          {error}
        </p>
      )}
      {pendingMessage && (
        <p
          className="mt-2 rounded-md bg-[var(--surface)] px-3 py-2 text-sm text-[var(--warning)]"
          role="status"
        >
          {pendingMessage}
        </p>
      )}
    </form>
  )
}
