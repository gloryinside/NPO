'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface FailedLog {
  id: string
  kind: string
  ref_id: string | null
  recipient_email: string
  status: string
  error: string | null
  sent_at: string
}

const KIND_LABELS: Record<string, string> = {
  campaign_closed_thanks: '캠페인 감사 메일',
  churn_risk_weekly: '주간 이탈 알림',
}

export function FailedEmailsWidget() {
  const [items, setItems] = useState<FailedLog[] | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/notifications/failed')
      if (!res.ok) throw new Error('조회 실패')
      const body = (await res.json()) as { items: FailedLog[] }
      setItems(body.items)
    } catch {
      setItems([])
      toast.error('실패 이메일 조회 실패')
    }
  }

  useEffect(() => { load() }, [])

  async function retry(id: string) {
    setRetrying(id)
    try {
      const res = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: id }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('재전송 성공')
        await load()
      } else {
        toast.error(body?.error ?? '재전송 실패')
      }
    } finally {
      setRetrying(null)
    }
  }

  if (items === null) {
    return <p className="text-xs text-[var(--muted-foreground)]">로딩 중…</p>
  }
  if (items.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)]">최근 30일간 실패한 이메일이 없습니다.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const label = KIND_LABELS[item.kind] ?? item.kind
        const isRetriable = item.kind === 'campaign_closed_thanks'
        return (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--text)]">{label}</span>
                <span className="text-[var(--muted-foreground)]">·</span>
                <span className="text-[var(--muted-foreground)] truncate">{item.recipient_email}</span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
                {new Date(item.sent_at).toLocaleString('ko-KR')}
              </div>
              {item.error && (
                <div className="text-[11px] text-[var(--negative)] mt-1 truncate">{item.error}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => retry(item.id)}
              disabled={!isRetriable || retrying === item.id}
              className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
              title={isRetriable ? '재전송' : '자동 재시도 대상만 수동 재전송 가능'}
            >
              {retrying === item.id ? '…' : '재전송'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
