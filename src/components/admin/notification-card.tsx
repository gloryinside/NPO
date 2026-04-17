'use client';

import { useRouter } from 'next/navigation';

const TYPE_ICON: Record<string, string> = {
  billing_failed: '⚠️',
  pledge_suspended: '🚫',
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR');
}

export function NotificationCard({ notification }: { notification: { id: string; type: string; title: string; body: string; read: boolean; created_at: string } }) {
  const router = useRouter();
  const n = notification;

  async function handleMarkRead() {
    if (n.read) return;
    await fetch(`/api/admin/notifications/${n.id}/read`, { method: 'PATCH' });
    router.refresh();
  }

  return (
    <div
      onClick={handleMarkRead}
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--border)',
        background: n.read ? 'var(--surface)' : 'var(--surface-2)',
        opacity: n.read ? 0.7 : 1,
        cursor: n.read ? 'default' : 'pointer',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{TYPE_ICON[n.type] ?? '🔔'}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{n.body}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatDate(n.created_at)}</span>
            {!n.read && <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>클릭하여 읽음 처리</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
