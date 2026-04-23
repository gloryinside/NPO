import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getNotificationPrefs } from '@/lib/donor/notification-prefs'
import { NotificationPrefsForm } from '@/components/donor/settings/NotificationPrefsForm'

export const metadata = { title: '설정' }

export default async function DonorSettingsPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">설정</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          알림 및 계정 환경을 관리하세요.
        </p>
      </div>

      {/* 알림 설정 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          이메일 알림
        </h2>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <NotificationPrefsForm initial={prefs} />
        </div>
      </section>

      {/* 빠른 이동 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          바로가기
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { href: '/donor', icon: '🏠', label: '홈으로' },
            { href: '/donor/promises', icon: '📋', label: '약정 관리' },
            { href: '/donor/payments', icon: '💳', label: '납입 내역' },
            { href: '/donor/receipts', icon: '🧾', label: '영수증' },
            { href: '/donor/impact', icon: '✨', label: '나의 임팩트' },
            { href: '/donor/invite', icon: '🎁', label: '친구 초대' },
          ].map(({ href, icon, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                textDecoration: 'none',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              {label}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
