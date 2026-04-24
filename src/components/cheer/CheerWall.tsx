import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { getDonorSession } from '@/lib/auth'
import {
  listFeaturedCheerMessages,
  listPublicCheerMessages,
} from '@/lib/cheer/messages'
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
 * G-D174: 관리자가 선정한 "대표 응원" 최대 3건을 상단에 별도 섹션으로 노출.
 */
export async function CheerWall({ campaignId, title = '후원자들의 응원' }: Props) {
  const tenant = await getTenant()
  if (!tenant) return null

  const supabase = createSupabaseAdminClient()
  const [featured, messages, session] = await Promise.all([
    listFeaturedCheerMessages(supabase, {
      orgId: tenant.id,
      campaignId,
    }),
    listPublicCheerMessages(supabase, {
      orgId: tenant.id,
      campaignId,
      limit: INITIAL_PAGE_SIZE,
    }),
    getDonorSession(),
  ])

  // featured와 일반 목록 중복 제거 — 일반 목록에서 featured에 포함된 id 제외
  const featuredIds = new Set(featured.map((f) => f.id))
  const generalMessages = messages.filter((m) => !featuredIds.has(m.id))

  // G-110: limit과 같은 건수면 다음 페이지가 있을 "가능성"을 클라이언트에 전달
  // (중복 제거 후 건수로 판단하면 false negative가 생길 수 있으므로 원본 기준 유지)
  const initialNextCursor =
    messages.length === INITIAL_PAGE_SIZE
      ? messages[messages.length - 1]!.createdAt
      : null

  return (
    <section className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-[var(--text)]">{title}</h2>
        {generalMessages.length > 0 && !initialNextCursor && (
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

      {/* G-D174: 대표 응원 섹션 — 관리자 큐레이션, 캠페인당 최대 3건 */}
      {featured.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              ⭐ 대표 응원
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              관리자가 선정한 응원 메시지
            </span>
          </div>
          <ul className="space-y-3">
            {featured.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border p-4"
                style={{
                  borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
                  background:
                    'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-2) 100%)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text)' }}
                  >
                    {m.displayName}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    대표 응원
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
                  {m.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CheerForm
        campaignId={campaignId}
        loggedIn={!!session}
      />

      <CheerList
        initialMessages={generalMessages}
        initialNextCursor={initialNextCursor}
        campaignId={campaignId}
        pageSize={INITIAL_PAGE_SIZE}
      />
    </section>
  )
}
