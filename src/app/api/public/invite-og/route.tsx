import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { findReferrerByCode } from '@/lib/donor/referral'
import { maskName } from '@/lib/cheer/messages'
import { loadKoreanFonts } from '@/lib/og/fonts'

/**
 * GET /api/public/invite-og?ref=<code>
 *
 * Phase 7-B / G-118: 초대 링크 카카오/페이스북 공유 시 미리보기 이미지.
 * - 무인증 공용 엔드포인트 — 초대 받은 사람이 링크 fetch 시 크롤러가 접근
 * - `ref` 없거나 유효하지 않으면 기관 맥락 없는 범용 fallback 카드 (200 OK)
 * - `ref` 유효하면 "{초대자 마스킹}님이 {기관명} 후원에 초대했어요" 카드
 * - 공용 캐시 (CDN-friendly) — 초대 코드 생명주기 동안 변경 없음
 */
export const runtime = 'nodejs'

export const FALLBACK_ORG = '후원 기관'

export interface InviteOgContext {
  orgName: string
  inviterName: string | null
}

export async function loadInviteOgContext(
  supabase: SupabaseClient,
  ref: string | null,
): Promise<InviteOgContext> {
  if (!ref) return { orgName: FALLBACK_ORG, inviterName: null }

  const referrer = await findReferrerByCode(supabase, ref)
  if (!referrer) return { orgName: FALLBACK_ORG, inviterName: null }

  const [orgRow, memberRow] = await Promise.all([
    supabase
      .from('orgs')
      .select('name')
      .eq('id', referrer.orgId)
      .maybeSingle(),
    supabase
      .from('members')
      .select('name')
      .eq('id', referrer.memberId)
      .maybeSingle(),
  ])

  return {
    orgName: (orgRow.data?.name as string | undefined) ?? FALLBACK_ORG,
    inviterName: (memberRow.data?.name as string | undefined) ?? null,
  }
}

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  const supabase = createSupabaseAdminClient()
  const { orgName, inviterName } = await loadInviteOgContext(supabase, ref)
  const maskedInviter = inviterName ? maskName(inviterName) : null

  const fonts = await loadKoreanFonts()
  const fontFamily = fonts ? 'NotoSansKR, sans-serif' : 'sans-serif'

  const headline = maskedInviter
    ? `${maskedInviter}님이 초대했어요`
    : '함께 후원해요'
  const subhead = `${orgName} 후원 프로그램`

  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)',
          color: 'white',
          fontFamily,
          padding: '72px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            opacity: 0.85,
            marginBottom: '32px',
            display: 'flex',
            letterSpacing: '0.08em',
          }}
        >
          💌 초대장
        </div>
        <div
          style={{
            fontSize: '72px',
            fontWeight: 800,
            marginBottom: '28px',
            display: 'flex',
            lineHeight: 1.15,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            marginBottom: '48px',
            display: 'flex',
          }}
        >
          {subhead}
        </div>
        <div
          style={{
            fontSize: '26px',
            opacity: 0.75,
            display: 'flex',
            maxWidth: '860px',
            lineHeight: 1.4,
          }}
        >
          작은 마음이 모여 더 큰 변화를 만듭니다. 아래 링크로 함께해 주세요.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts ?? undefined,
    },
  )

  // 공용 캐시 — 초대 코드/기관명은 코드 생명주기 동안 변경 없음.
  // CDN 1일, 브라우저 1시간 — 카톡/페북 크롤러 재방문 시 DB/렌더 절감.
  image.headers.set(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
  )
  return image
}
