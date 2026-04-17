import { getCampaignProgress } from '@/lib/campaign-builder/progress';

export async function FundraisingProgress({ block, slug }: { block: { props: any }; slug: string }) {
  const p = await getCampaignProgress(slug);
  const daysLeft =
    p.endDate
      ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86_400_000))
      : null;

  return (
    <section className="mx-auto my-8 max-w-3xl px-4">
      <div className="mb-2 flex justify-between text-sm" style={{ color: 'var(--text)' }}>
        <span>{p.raised.toLocaleString('ko-KR')}원 모금</span>
        <span>{p.percent}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full transition-[width]" style={{ width: `${p.percent}%`, background: 'var(--accent)' }} />
      </div>
      <div className="mt-3 flex gap-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {block.props.showDonorCount ? (
          <span>{p.donorCount.toLocaleString('ko-KR')}명 참여</span>
        ) : null}
        {block.props.showDDay && daysLeft !== null ? <span>D-{daysLeft}</span> : null}
      </div>
    </section>
  );
}
