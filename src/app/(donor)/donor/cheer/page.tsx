import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listOwnCheerMessages } from '@/lib/cheer/messages'
import { OwnCheerList } from '@/components/donor/cheer/OwnCheerList'

/**
 * Phase 6-B / G-111: 내가 쓴 응원 관리 페이지.
 *   - 공개 / 대기 / 관리자 숨김 / 자진 삭제 상태 투명하게 표시
 *   - 본인이 쓴 것만 soft-delete 가능 (hidden=true + self_deleted 마커)
 */
export default async function DonorCheerPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')

  const supabase = createSupabaseAdminClient()
  const items = await listOwnCheerMessages(supabase, session.member.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">내 응원</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          공개된 응원, 승인 대기 중인 응원, 삭제된 응원을 모두 확인할 수 있습니다.
        </p>
      </div>
      <OwnCheerList items={items} />
    </div>
  )
}
