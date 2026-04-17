import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { NotificationCard } from '@/components/admin/notification-card';

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
            <NotificationCard
              key={n.id as string}
              notification={{
                id: n.id as string,
                type: n.type as string,
                title: n.title as string,
                body: n.body as string,
                read: n.read as boolean,
                created_at: n.created_at as string,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
