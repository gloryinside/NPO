import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { getDonorSession } from '@/lib/auth'
import { listPublicCheerMessages } from '@/lib/cheer/messages'
import { CheerForm } from './CheerForm'

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
      limit: 50,
    }),
    getDonorSession(),
  ])

  return (
    <section className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-[var(--text)]">{title}</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          총 {messages.length}개
        </span>
      </div>

      <CheerForm
        campaignId={campaignId}
        loggedIn={!!session}
      />

      {messages.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] py-10 text-center">
          <p className="text-sm text-[var(--text)]">
            아직 등록된 응원 메시지가 없습니다.
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            첫 번째 응원을 남겨주세요.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {m.displayName}
                </span>
                <time className="text-xs text-[var(--muted-foreground)]">
                  {formatRelative(m.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const diff = now - t
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return iso
  }
}
