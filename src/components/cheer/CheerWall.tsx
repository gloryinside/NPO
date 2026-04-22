import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { getDonorSession } from '@/lib/auth'
import { listPublicCheerMessages } from '@/lib/cheer/messages'
import { CheerForm } from './CheerForm'
import { CheerList } from './CheerList'

const INITIAL_PAGE_SIZE = 50

interface Props {
  campaignId: string | null
  title?: string
}

/**
 * Phase 5-D: 응원 메시지 벽 — 서버 컴포넌트로 초기 50건 + 로그인 여부에 따라 폼 분기.
 *
 * 캠페인 공개 페이지 하단에 삽입. 빌더/레거시 두 렌더 경로 모두에서 호출 가능.
 */
export async function CheerWall({ campaignId, title = '후원자들의 응원' }: Props) {
  const tenant = await getTenant()
  if (!tenant) return null

  const supabase = createSupabaseAdminClient()
  const [messages, session] = await Promise.all([
    listPublicCheerMessages(supabase, {
      orgId: tenant.id,
      campaignId,
      limit: INITIAL_PAGE_SIZE,
    }),
    getDonorSession(),
  ])

  // G-110: limit과 같은 건수면 다음 페이지가 있을 "가능성"을 클라이언트에 전달
  const initialNextCursor =
    messages.length === INITIAL_PAGE_SIZE
      ? messages[messages.length - 1]!.createdAt
      : null

  return (
    <section className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-[var(--text)]">{title}</h2>
        {messages.length > 0 && !initialNextCursor && (
          <span className="text-xs text-[var(--muted-foreground)]">
            총 {messages.length}개
          </span>
        )}
        {initialNextCursor && (
          <span className="text-xs text-[var(--muted-foreground)]">
            최근 {INITIAL_PAGE_SIZE}개 표시
          </span>
        )}
      </div>

      <CheerForm
        campaignId={campaignId}
        loggedIn={!!session}
      />

      <CheerList
        initialMessages={messages}
        initialNextCursor={initialNextCursor}
        campaignId={campaignId}
        pageSize={INITIAL_PAGE_SIZE}
      />
    </section>
  )
}
