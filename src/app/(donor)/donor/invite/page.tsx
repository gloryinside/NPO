import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDonorSession } from '@/lib/auth'
import { getTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  ensureReferralCode,
  getReferralStats,
} from '@/lib/donor/referral'
import { ReferralCodeCard } from '@/components/donor/invite/ReferralCodeCard'
import { ReferralRetryButton } from '@/components/donor/invite/ReferralRetryButton'

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return iso
  }
}

function maskName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '후원자'
  const first = trimmed[0]
  const rest = '○'.repeat(Math.max(1, Math.min(3, trimmed.length - 1)))
  return `${first}${rest}`
}

/**
 * Phase 5-B: 후원자 초대 프로그램 페이지.
 *   - 내 초대 코드 (없으면 자동 발급)
 *   - 내 초대로 가입한 후원자 수 + 그들의 누적 후원액
 *   - 초대 링크 복사 / 공유
 */
export default async function DonorInvitePage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')

  const tenant = await getTenant()
  const orgName = tenant?.name ?? '기관'

  const admin = createSupabaseAdminClient()
  const ensured = await ensureReferralCode(
    admin,
    session.member.org_id,
    session.member.id
  )

  if (!ensured.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">초대 프로그램</h1>
        <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative)]/10 p-6 text-center">
          <p className="text-sm text-[var(--negative)]">
            초대 코드를 발급할 수 없습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            오류: {ensured.error}
          </p>
          <ReferralRetryButton />
        </div>
      </div>
    )
  }

  const stats = await getReferralStats(admin, session.member.id)

  // origin 구성 — Vercel/Proxy 환경 모두 대응
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const signupOrigin = host ? `${proto}://${host}` : ''

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">초대 프로그램</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          <b className="text-[var(--text)]">{orgName}</b>의 후원에 지인을
          초대하고, 함께 변화를 만들어 보세요.
        </p>
      </div>

      {/* 내 코드 카드 */}
      <ReferralCodeCard
        code={ensured.code.code}
        signupOrigin={signupOrigin}
        orgName={orgName}
        inviterName={session.member.name ?? null}
      />

      {/* 초대 현황 지표 */}
      <section className="grid grid-cols-2 gap-4">
        <MetricCard
          icon="👥"
          label="초대 성공"
          value={`${stats.invitedCount}명`}
          color="var(--accent)"
        />
        <MetricCard
          icon="💰"
          label="초대 후원자 누적 후원액"
          value={formatKRW(stats.totalRaisedByInvitees)}
          color="var(--positive)"
        />
      </section>

      {/* 초대한 회원 목록 */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          내가 초대한 후원자
        </h2>
        {stats.invitees.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-12 text-center">
            <p className="text-5xl mb-3">✉️</p>
            <p className="text-sm text-[var(--text)]">
              아직 내 코드로 가입한 분이 없습니다.
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              위의 초대 링크를 주변에 공유해 보세요.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    후원자
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    누적 후원액
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.invitees.map((i) => (
                  <tr
                    key={i.memberId}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {maskName(i.name)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      {formatDate(i.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--accent)]">
                      {formatKRW(i.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 뒤로가기 */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-6 text-center">
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href="/donor"
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80"
          >
            ← 마이페이지
          </a>
          <a
            href="/donor/impact"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90"
          >
            내 임팩트 보기 →
          </a>
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
        {label}
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}
