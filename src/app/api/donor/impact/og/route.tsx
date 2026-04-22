import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorSession } from '@/lib/auth'
import { getDonorImpact } from '@/lib/donor/impact'

/**
 * GET /api/donor/impact/og
 *
 * Phase 5-A: 후원자 임팩트 소셜 공유 OG 이미지.
 * - 후원자 로그인 상태에서만 자신의 카드 생성 가능
 * - 이름은 "김○○" 마스킹 처리 (프라이버시)
 * - 1200×630 (Open Graph 표준)
 *
 * 호출 예: /api/donor/impact/og → 이미지 반환
 * SNS 미리보기에서 쓸 때는 /donor/impact/share 페이지의 meta[og:image]로 지정.
 */
export const runtime = 'nodejs'

function maskName(name: string): string {
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '○'
  return name[0] + '○'.repeat(name.length - 1)
}

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만원`
  return `${n.toLocaleString('ko-KR')}원`
}

export async function GET(_req: NextRequest) {
  const session = await getDonorSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const impact = await getDonorImpact(supabase, session.member.org_id, session.member.id)

  const { data: orgRow } = await supabase
    .from('orgs')
    .select('name')
    .eq('id', session.member.org_id)
    .maybeSingle()

  const orgName = (orgRow?.name as string) ?? '기관'
  const maskedName = maskName(session.member.name)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a3a5c 0%, #7c3aed 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ fontSize: '28px', opacity: 0.8, marginBottom: '24px', display: 'flex' }}>
          ✨ 나의 후원 임팩트
        </div>
        <div style={{ fontSize: '56px', fontWeight: 800, marginBottom: '16px', display: 'flex' }}>
          {maskedName}님의 따뜻한 마음
        </div>
        <div style={{ fontSize: '40px', fontWeight: 700, color: '#fff', marginBottom: '40px', display: 'flex' }}>
          {formatKRW(impact.totalAmount)}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '40px',
            fontSize: '24px',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 700 }}>{impact.paymentCount}</div>
            <div style={{ fontSize: '18px', opacity: 0.7 }}>후원 건수</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 700 }}>{impact.activeMonths}</div>
            <div style={{ fontSize: '18px', opacity: 0.7 }}>함께한 개월</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 700 }}>{impact.byCampaign.length}</div>
            <div style={{ fontSize: '18px', opacity: 0.7 }}>참여 캠페인</div>
          </div>
        </div>
        <div
          style={{
            marginTop: '60px',
            fontSize: '20px',
            opacity: 0.7,
            display: 'flex',
          }}
        >
          {orgName}과 함께
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
