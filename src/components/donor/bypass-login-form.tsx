'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BYPASS_FIXED_CODE } from '@/lib/auth/donor-bypass'

type Phase = 'identifier' | 'code'

/**
 * 개발용 로그인 우회 폼. NEXT_PUBLIC_DONOR_AUTH_BYPASS=1 일 때만 렌더된다.
 * "아무 이메일/연락처 + 고정 코드 000000"으로 로그인 → member 자동 생성/조회.
 */
export function BypassLoginForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('identifier')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function advanceToCode() {
    if (!identifier.trim()) return
    setError(null)
    setCode(BYPASS_FIXED_CODE) // 자동 채움 — 사용자는 그냥 로그인 누르면 됨
    setPhase('code')
  }

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/donor-bypass', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        detail?: string | null
      }
      if (!res.ok) {
        setError(data.error ?? '로그인 실패')
        return
      }
      router.push('/donor')
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="note"
        className="rounded-md border px-3 py-2 text-xs"
        style={{
          borderColor: 'var(--warning-border, var(--border))',
          background: 'var(--surface-2)',
          color: 'var(--text)',
        }}
      >
        🧪 개발용 로그인 모드 — 아무 이메일/연락처 입력 시 코드{' '}
        <span className="font-mono font-bold">{BYPASS_FIXED_CODE}</span>로 로그인
      </div>

      {phase === 'identifier' ? (
        <>
          <input
            type="text"
            placeholder="이메일 또는 전화번호"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            type="button"
            onClick={advanceToCode}
            disabled={!identifier.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            인증번호 받기
          </button>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              {identifier}
            </span>
            에 전송된 코드:
          </p>
          <div
            className="rounded-lg border px-3 py-4 text-center font-mono text-2xl tracking-[0.4em]"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            {BYPASS_FIXED_CODE}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={loading || code !== BYPASS_FIXED_CODE}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase('identifier')
              setCode('')
              setError(null)
            }}
            className="text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            다시 입력
          </button>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm"
          style={{ color: 'var(--negative)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
