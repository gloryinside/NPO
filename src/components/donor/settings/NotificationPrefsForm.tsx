'use client'

import { useEffect, useState, useTransition } from 'react'
import type { NotificationPrefs } from '@/lib/donor/notification-prefs'

interface Props {
  initial: NotificationPrefs
}

const PREF_ITEMS: {
  key: keyof NotificationPrefs
  label: string
  desc: string
}[] = [
  {
    key: 'amount_change',
    label: '정기후원 금액 변경 알림',
    desc: '후원 금액이 변경될 때 이메일로 알려드립니다.',
  },
  {
    key: 'payment_confirmation',
    label: '결제 완료 알림',
    desc: '후원금 결제가 완료되면 확인 이메일을 보내드립니다.',
  },
  {
    key: 'receipt_issued',
    label: '영수증 발급 알림',
    desc: '기부금 영수증 PDF가 생성되면 알려드립니다.',
  },
  {
    key: 'promise_status',
    label: '약정 상태 변경 알림',
    desc: '약정이 일시중지·재개·해지되면 이메일로 알려드립니다.',
  },
  {
    key: 'campaign_update',
    label: '캠페인 소식',
    desc: '후원하신 캠페인의 진행 소식과 후기를 받습니다.',
  },
]

export function NotificationPrefsForm({ initial }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  // G-D15: 성공 메시지는 3초 뒤 자동 사라지도록
  useEffect(() => {
    if (status !== 'ok') return
    const t = setTimeout(() => setStatus('idle'), 3000)
    return () => clearTimeout(t)
  }, [status])

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setStatus('idle')

    startTransition(async () => {
      const res = await fetch('/api/donor/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      setStatus(res.ok ? 'ok' : 'err')
      if (!res.ok) setPrefs(prefs)
    })
  }

  return (
    <div className={isPending ? 'opacity-70 pointer-events-none' : ''}>
      {PREF_ITEMS.map(({ key, label, desc }, idx) => (
        <label
          key={key}
          className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4"
          style={{
            borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div className="flex items-start gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{desc}</p>
            </div>
          </div>

          {/* 커스텀 토글 */}
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={() => toggle(key)}
              disabled={isPending}
              aria-label={label}
              className="sr-only"
            />
            <div
              className="h-6 w-11 rounded-full transition-colors duration-200"
              style={{
                background: prefs[key] ? 'var(--accent)' : 'var(--border)',
              }}
            />
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{
                transform: prefs[key] ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
              }}
            />
          </div>
        </label>
      ))}

      {/* 상태 피드백 */}
      {status !== 'idle' && (
        <div
          className="border-t px-5 py-3 text-xs font-medium"
          style={{
            borderColor: 'var(--border)',
            color: status === 'ok' ? 'var(--positive)' : 'var(--negative)',
            background: status === 'ok' ? 'var(--positive-soft)' : 'var(--negative-soft)',
          }}
        >
          {status === 'ok' ? '✓ 저장되었습니다.' : '✗ 저장에 실패했습니다. 다시 시도해주세요.'}
        </div>
      )}
    </div>
  )
}
