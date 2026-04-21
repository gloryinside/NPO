import { redirect } from 'next/navigation';

// /campaigns/[slug]/donate는 더 이상 자체 폼을 렌더하지 않는다.
// 단일 결제 진입점으로 위저드(/donate/wizard?campaign=slug)로 리다이렉트.
export default async function CampaignDonatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/donate/wizard?campaign=${encodeURIComponent(slug)}`);
}
