import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const TYPE_ICON: Record<string, string> = {
  billing_failed: '\u26A0\uFE0F',
  pledge_suspended: '\uD83D\uDEAB',
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR');
}

export default async function NotificationsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: notifications } = await supabase
    .from('admin_notifications')
    .select('*')
    .eq('org_id', tenant.id)
    .order('created_at', { ascending: false })
    .range(0, 49);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>알림</h1>
      <div className="space-y-3">
        {(notifications ?? []).length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>알림이 없습니다.</p>
        ) : (
          (notifications ?? []).map((n: Record<string, unknown>) => (
            <div
              key={n.id as string}
              className="rounded-lg border p-4"
              style={{
                borderColor: 'var(--border)',
                background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{TYPE_ICON[n.type as string] ?? '\uD83D\uDD14'}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title as string}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{n.body as string}</div>
                  <div className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>{formatDate(n.created_at as string)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
