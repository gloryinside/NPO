'use client'

import { useState, useTransition } from 'react'
import type { NotificationPrefs } from '@/lib/donor/notification-prefs'

interface Props {
  initial: NotificationPrefs
}

export function NotificationPrefsForm({ initial }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setMessage(null)

    startTransition(async () => {
      const res = await fetch('/api/donor/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (res.ok) {
        setMessage('저장되었습니다.')
      } else {
        setPrefs(prefs)
        setMessage('저장에 실패했습니다. 다시 시도해주세요.')
      }
    })
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: '1rem' }}>
        이메일 수신 설정
      </h2>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            정기후원 금액 변경 알림
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            후원 금액이 변경될 때 감사 이메일을 받습니다
          </div>
        </div>
        <input
          type="checkbox"
          checked={prefs.amount_change}
          onChange={() => toggle('amount_change')}
          disabled={isPending}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
      </label>

      {message && (
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: 13,
            color: message.includes('실패') ? 'var(--destructive)' : 'var(--muted-foreground)',
          }}
        >
          {message}
        </p>
      )}
    </section>
  )
}
