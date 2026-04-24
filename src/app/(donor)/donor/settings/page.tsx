import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getNotificationPrefs } from '@/lib/donor/notification-prefs'
import { NotificationPrefsForm } from '@/components/donor/settings/NotificationPrefsForm'
import { PasswordChangeCard } from '@/components/donor/settings/PasswordChangeCard'
import { MfaCard } from '@/components/donor/settings/MfaCard'
import { AccountDeleteCard } from '@/components/donor/settings/AccountDeleteCard'
import { LocaleToggle } from '@/components/donor/ui/LocaleToggle'
import { ConsentCard } from '@/components/donor/settings/ConsentCard'

export const metadata = { title: '설정' }

export default async function DonorSettingsPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)
  const isSupabaseAuth = session.authMethod === 'supabase'

  // G-D98: consent 초기값 조회
  const { data: consentRow } = await supabase
    .from('members')
    .select('marketing_consent, marketing_consent_at')
    .eq('id', session.member.id)
    .maybeSingle()
  const marketingConsent = Boolean(consentRow?.marketing_consent)
  const marketingConsentAt =
    (consentRow?.marketing_consent_at as string | null) ?? null

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">설정</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          알림, 보안, 계정 환경을 관리하세요.
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

      {/* 마케팅 수신 동의 (G-D98) */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          수신 동의
        </h2>
        <ConsentCard
          initial={marketingConsent}
          initialAt={marketingConsentAt}
        />
      </section>

      {/* 보안 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          보안
        </h2>
        <div className="space-y-3">
          <PasswordChangeCard enabled={isSupabaseAuth} />
          <MfaCard />
        </div>
      </section>

      {/* 언어 설정 (G-D44) */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          언어 / Language
        </h2>
        <div
          className="flex items-center justify-between rounded-2xl border px-5 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-sm text-[var(--text)]">
            표시 언어를 선택하세요.
          </p>
          <LocaleToggle />
        </div>
      </section>

      {/* 바로가기 */}
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

      {/* 데이터 내보내기 (G-D62) */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          내 데이터
        </h2>
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-sm font-medium text-[var(--text)]">
            본인 데이터 일괄 내보내기
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            프로필, 약정, 납입, 영수증 메타, 응원 메시지, 계정 활동 이력을 JSON 으로 다운로드합니다.
            (개인정보 보호법·GDPR 제15조 본인확인)
          </p>
          <a
            href="/api/donor/account/export"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
            style={{
              borderColor: 'var(--accent)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            📥 JSON 내보내기
          </a>
        </div>
      </section>

      {/* 위험 영역 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          위험 영역
        </h2>
        <AccountDeleteCard authMethod={session.authMethod} />
      </section>
    </div>
  )
}
