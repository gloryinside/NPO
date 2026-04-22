'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  memberId: string
  /** 최근 invite 발송 시각 (ISO). 쿨다운 계산용. null이면 발송 이력 없음. */
  lastSentAt: string | null
  /** 쿨다운 일수 — 서버 API와 일치해야 함 */
  cooldownDays?: number
}

const DEFAULT_COOLDOWN_DAYS = 3

function formatCooldownRemaining(sentAt: string, cooldownDays: number): string | null {
  const sentTs = Date.parse(sentAt)
  if (!Number.isFinite(sentTs)) return null
  const remainingMs = sentTs + cooldownDays * 86_400_000 - Date.now()
  if (remainingMs <= 0) return null
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000))
  if (hours <= 1) return '1시간 후 재발송 가능'
  if (hours < 24) return `${hours}시간 후 재발송 가능`
  const days = Math.ceil(hours / 24)
  return `${days}일 후 재발송 가능`
}

export function InviteButton({
  memberId,
  lastSentAt,
  cooldownDays = DEFAULT_COOLDOWN_DAYS,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cooldownMessage = lastSentAt
    ? formatCooldownRemaining(lastSentAt, cooldownDays)
    : null
  const inCooldown = cooldownMessage !== null

  function onClick() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/members/${memberId}/invite`, {
          method: 'POST',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const code = data?.error as string | undefined
          const map: Record<string, string> = {
            ALREADY_LINKED: '이미 로그인 연결된 회원입니다.',
            NO_EMAIL: '이메일이 등록되지 않아 초대를 보낼 수 없습니다.',
            COOLDOWN: '최근 3일 이내 이미 초대를 발송했습니다.',
            SEND_FAILED: '메일 발송에 실패했습니다.',
            NOT_FOUND: '후원자를 찾을 수 없습니다.',
          }
          setError(map[code ?? ''] ?? data?.error ?? '발송 실패')
          return
        }
        setMessage('초대 메일을 발송했습니다.')
        router.refresh()
      } catch {
        setError('네트워크 오류로 발송하지 못했습니다.')
      }
    })
  }

  const label = lastSentAt ? '초대 메일 재발송' : '초대 메일 보내기'
  const disabled = isPending || inCooldown

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          background: 'var(--surface)',
        }}
      >
        {isPending ? '발송 중…' : label}
      </button>
      {inCooldown && (
        <span className="text-xs text-[var(--muted-foreground)]">
          {cooldownMessage}
        </span>
      )}
      {message && (
        <span className="text-xs" style={{ color: 'var(--positive)' }}>
          {message}
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: 'var(--negative)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
