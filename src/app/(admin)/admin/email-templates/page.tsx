import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS } from '@/lib/email/default-templates';
import Link from 'next/link';

const ICONS: Record<string, string> = {
  donation_thanks: '💝',
  offline_received: '🏦',
  receipt_issued: '🧾',
  billing_failed: '⚠️',
  billing_reminder: '🔔',
  welcome: '👋',
};

export default async function EmailTemplatesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: customs } = await supabase
    .from('email_templates')
    .select('scenario, is_active, updated_at')
    .eq('org_id', tenant.id);

  const customMap = new Map(
    (customs ?? []).map((c) => [c.scenario, c])
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">이메일 템플릿</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        시나리오별 이메일 내용을 커스터마이징하세요.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((s) => {
          const custom = customMap.get(s.key);
          const isCustom = !!custom;
          const isActive = custom?.is_active ?? true;

          return (
            <Link
              key={s.key}
              href={`/admin/email-templates/${s.key}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{ICONS[s.key] ?? '📧'}</span>
                <div className="flex gap-1.5">
                  <span className={[
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    isCustom ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--muted-foreground)]',
                  ].join(' ')}>
                    {isCustom ? '커스텀' : '기본'}
                  </span>
                  {!isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--negative)]/10 text-[var(--negative)] font-medium">
                      비활성
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-1">{s.label}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{s.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
