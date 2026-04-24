import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/donor'
import { getNotificationPrefs } from '@/lib/donor/notification-prefs'
import { NotificationPrefsForm } from '@/components/donor/settings/NotificationPrefsForm'
import { PasswordChangeCard } from '@/components/donor/settings/PasswordChangeCard'
import { MfaCard } from '@/components/donor/settings/MfaCard'
import { AccountDeleteCard } from '@/components/donor/settings/AccountDeleteCard'
import { LocaleToggle } from '@/components/donor/ui/LocaleToggle'
import { ConsentCard } from '@/components/donor/settings/ConsentCard'
import { SessionsCard } from '@/components/donor/settings/SessionsCard'

export const metadata = { title: 'Settings' }

export default async function DonorSettingsPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')
  const t = await getT()

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)
  const isSupabaseAuth = session.authMethod === 'supabase'

  const { data: consentRow } = await supabase
    .from('members')
    .select('marketing_consent, marketing_consent_at')
    .eq('id', session.member.id)
    .maybeSingle()
  const marketingConsent = Boolean(consentRow?.marketing_consent)
  const marketingConsentAt =
    (consentRow?.marketing_consent_at as string | null) ?? null

  const shortcuts = [
    { href: '/donor', icon: '🏠', label: t('donor.settings.shortcut.home') },
    { href: '/donor/promises', icon: '📋', label: t('donor.settings.shortcut.promises') },
    { href: '/donor/payments', icon: '💳', label: t('donor.settings.shortcut.payments') },
    { href: '/donor/receipts', icon: '🧾', label: t('donor.settings.shortcut.receipts') },
    { href: '/donor/impact', icon: '✨', label: t('donor.settings.shortcut.impact') },
    { href: '/donor/invite', icon: '🎁', label: t('donor.settings.shortcut.invite') },
  ]

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{t('donor.settings.title')}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {t('donor.settings.subtitle')}
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.notifications')}
        </h2>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <NotificationPrefsForm initial={prefs} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.consent')}
        </h2>
        <ConsentCard initial={marketingConsent} initialAt={marketingConsentAt} />
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.security')}
        </h2>
        <div className="space-y-3">
          <PasswordChangeCard enabled={isSupabaseAuth} />
          <MfaCard />
          <SessionsCard />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.language')}
        </h2>
        <div
          className="flex items-center justify-between rounded-2xl border px-5 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-sm text-[var(--text)]">
            {t('donor.settings.language_hint')}
          </p>
          <LocaleToggle />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.shortcuts')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shortcuts.map(({ href, icon, label }) => (
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
              <span style={{ fontSize: 18 }} aria-hidden="true">
                {icon}
              </span>
              {label}
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.data')}
        </h2>
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-sm font-medium text-[var(--text)]">
            {t('donor.settings.data.title')}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t('donor.settings.data.body')}
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
            <span aria-hidden="true">📥</span> {t('donor.settings.data.cta')}
          </a>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--text)]">
          {t('donor.settings.section.danger')}
        </h2>
        <AccountDeleteCard authMethod={session.authMethod} />
      </section>
    </div>
  )
}
