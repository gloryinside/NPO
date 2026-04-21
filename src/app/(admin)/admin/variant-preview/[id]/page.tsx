import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/lib/auth'
import '@/lib/landing-variants/register-all'
import { findVariant } from '@/lib/landing-variants'
import { VARIANT_COMPONENTS } from '@/components/landing-builder/variant-components'

/**
 * 단일 variant default 렌더 프리뷰 페이지.
 * Playwright 썸네일 자동 생성(G-73) 스크립트가 이 URL을 순회하며 스크린샷.
 *
 * 접근 제어: requireAdminUser — 관리자만 접근 가능.
 * 사용: /admin/variant-preview/hero-fullscreen-video
 */
export default async function VariantPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params

  const descriptor = findVariant(id)
  const Component = VARIANT_COMPONENTS[id]
  if (!descriptor || !Component) notFound()

  const data = descriptor.defaultData()

  // campaigns는 campaigns prop이 필요 — 더미 데이터 주입
  const isCampaigns = descriptor.type === 'campaigns'
  const dummyCampaigns = isCampaigns
    ? [
        { id: 'c1', title: '지역 아동 교육 지원 캠페인', slug: 'demo-1',
          description: '저소득 가정 아동에게 교육 기회를 제공합니다.',
          goal_amount: 10_000_000, ended_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          thumbnail_url: 'https://picsum.photos/seed/cp1/800/600', raised: 6_400_000 },
        { id: 'c2', title: '해외 긴급 구호', slug: 'demo-2',
          description: '자연재해 피해 지역 생필품 지원.',
          goal_amount: 20_000_000, ended_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          thumbnail_url: 'https://picsum.photos/seed/cp2/800/600', raised: 15_500_000 },
        { id: 'c3', title: '청소년 멘토링', slug: 'demo-3',
          description: '500명의 청소년이 진로 멘토와 연결.',
          goal_amount: 5_000_000, ended_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          thumbnail_url: 'https://picsum.photos/seed/cp3/800/600', raised: 2_100_000 },
      ]
    : []

  return (
    <div className="bg-[var(--bg)]">
      {isCampaigns
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? <Component data={data as any} campaigns={dummyCampaigns as any} />
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : <Component data={data as any} />}
    </div>
  )
}
