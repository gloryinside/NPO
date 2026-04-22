import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getNotificationPrefs } from '@/lib/donor/notification-prefs'
import { NotificationPrefsForm } from '@/components/donor/settings/NotificationPrefsForm'

export const metadata = { title: '알림 설정' }

export default async function DonorSettingsPage() {
  const session = await getDonorSession()
  if (!session) redirect('/login')

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>
        알림 설정
      </h1>
      <NotificationPrefsForm initial={prefs} />
    </main>
  )
}
