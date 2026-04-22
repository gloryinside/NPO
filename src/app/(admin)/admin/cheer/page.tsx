import { requireAdminUser } from '@/lib/auth'
import { requireTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  CheerModerationList,
  type AdminCheerRow,
} from '@/components/admin/cheer-moderation-list'

/**
 * Phase 5-D: admin 응원 메시지 검수 — 최신 200건.
 *   - 숨김/해제 토글
 *   - 캠페인 제목/회원 이름 표시(관리자에게는 원본)
 */
export default async function AdminCheerPage() {
  await requireAdminUser()
  const tenant = await requireTenant()
  const supabase = createSupabaseAdminClient()

  const { data } = await supabase
    .from('cheer_messages')
    .select(
      'id, body, anonymous, hidden, published, created_at, members!cheer_messages_member_id_fkey(id, name), campaigns(id, title)'
    )
    .eq('org_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows: AdminCheerRow[] = (data ?? []).map((r: unknown) => {
    const row = r as {
      id: string
      body: string
      anonymous: boolean
      hidden: boolean
      published: boolean
      created_at: string
      members: { name: string | null } | null
      campaigns: { title: string | null } | null
    }
    return {
      id: row.id,
      campaignTitle: row.campaigns?.title ?? null,
      memberName: row.members?.name ?? '(알 수 없음)',
      body: row.body,
      anonymous: row.anonymous,
      hidden: row.hidden,
      published: row.published,
      createdAt: row.created_at,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">응원 메시지 검수</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          부적절한 메시지는 숨김 처리할 수 있습니다. 최근 200건을 표시합니다.
        </p>
      </div>
      <CheerModerationList rows={rows} />
    </div>
  )
}
