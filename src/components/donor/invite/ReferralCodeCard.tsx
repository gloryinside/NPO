'use client'

import { useState } from 'react'

interface Props {
  code: string
  signupOrigin: string
  /** Phase 6-C: 공유 카피 맥락화 */
  orgName?: string
  inviterName?: string | null
}

function maskName(raw: string | null | undefined): string {
  const chars = Array.from((raw ?? '').trim())
  if (chars.length === 0) return '후원자'
  const head = chars[0]
  const tailLen = Math.max(1, Math.min(3, chars.length - 1))
  return head + '○'.repeat(tailLen)
}

/**
 * Phase 5-B / 6-C: 후원자 내 초대 코드 + 초대 링크 복사 카드.
 * 공유 메시지에 기관명과 초대자 이름(마스킹)을 포함해 수신자 맥락 강화.
 */
export function ReferralCodeCard({
  code,
  signupOrigin,
  orgName = '기관',
  inviterName = null,
}: Props) {
  const [copiedKind, setCopiedKind] = useState<
    'code' | 'link' | 'message' | null
  >(null)

  const inviteUrl = `${signupOrigin}/donor/signup?ref=${encodeURIComponent(code)}`
  const inviterDisplay = inviterName ? maskName(inviterName) : null
  const shareTitle = `${orgName} 후원 초대`
  const shareText = inviterDisplay
    ? `${inviterDisplay}님이 ${orgName} 후원에 초대했어요. 아래 링크로 함께해 주세요.`
    : `${orgName} 후원에 함께해 주세요.`
  const fullMessage = `${shareText}\n${inviteUrl}`

  async function copy(
    value: string,
    kind: 'code' | 'link' | 'message'
  ) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKind(kind)
      setTimeout(() => setCopiedKind(null), 1500)
    } catch {
      // 일부 브라우저에서 clipboard API 실패 가능 — 조용히 무시
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteUrl,
        })
        return
      } catch {
        // 사용자 취소 포함 — fallback으로 메시지 복사
      }
    }
    await copy(fullMessage, 'message')
  }

  return (
    <section className="rounded-xl border border-[var(--accent)]/30 p-6"
      style={{ background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))' }}>
      <div className="text-center">
        <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-2">
          내 초대 코드
        </p>
        <p
          className="font-mono text-3xl font-bold tracking-widest text-[var(--text)] mb-4 select-all"
          data-testid="referral-code-value"
        >
          {code}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80"
          >
            {copiedKind === 'code' ? '✓ 복사됨' : '코드 복사'}
          </button>
          <button
            type="button"
            onClick={() => copy(inviteUrl, 'link')}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80"
          >
            {copiedKind === 'link' ? '✓ 복사됨' : '초대 링크 복사'}
          </button>
          <button
            type="button"
            onClick={() => copy(fullMessage, 'message')}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80"
          >
            {copiedKind === 'message' ? '✓ 복사됨' : '메시지 복사'}
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90"
          >
            공유하기
          </button>
        </div>

        {/* 공유 메시지 프리뷰 */}
        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-left">
          <p className="mb-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            공유 메시지
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--text)]">
            {shareText}
          </p>
          <p className="mt-1 break-all text-xs text-[var(--muted-foreground)]">
            {inviteUrl}
          </p>
        </div>
      </div>
    </section>
  )
}
