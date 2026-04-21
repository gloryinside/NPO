import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export interface CampaignRow {
  id: string
  title: string
  slug: string
  description: string | null
  goal_amount: number | null
  ended_at: string | null
  thumbnail_url: string | null
  raised: number
}

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

interface Props {
  campaign: CampaignRow
  showProgress?: boolean
  compact?: boolean
}

/** campaigns variants에서 공용으로 쓰는 캠페인 카드 */
export function CampaignCard({ campaign, showProgress = true, compact = false }: Props) {
  const pct = campaign.goal_amount && campaign.goal_amount > 0
    ? Math.min(Math.round((campaign.raised / campaign.goal_amount) * 100), 100)
    : null
  const dday = campaign.ended_at
    ? Math.ceil((new Date(campaign.ended_at).getTime() - Date.now()) / 86400000)
    : null

  return (
    <Link href={`/campaigns/${campaign.slug}`} className="block group no-underline">
      <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full flex flex-col transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
        style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
        {campaign.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={campaign.thumbnail_url} alt={campaign.title}
            className={`w-full ${compact ? 'h-32' : 'h-48'} object-cover`} />
        ) : (
          <div className={`w-full ${compact ? 'h-32' : 'h-48'} bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)]`} />
        )}
        <div className={`${compact ? 'p-4' : 'p-5'} flex-1 flex flex-col`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-base font-semibold leading-snug text-[var(--text)] line-clamp-2">{campaign.title}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {dday !== null && dday >= 0 && (
                <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)]">D-{dday}</span>
              )}
              <Badge className="border-0 text-xs bg-[var(--positive)]/10 text-[var(--positive)]">진행 중</Badge>
            </div>
          </div>
          {campaign.description && (
            <p className="text-sm line-clamp-2 mb-3 flex-1 text-[var(--muted-foreground)]">{campaign.description}</p>
          )}
          {showProgress && pct !== null && (
            <div className="mt-auto mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--muted-foreground)]">{formatKRW(campaign.raised)}</span>
                <span className="text-[var(--muted-foreground)]">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs mt-1 text-right text-[var(--muted-foreground)]">
                목표 {formatKRW(campaign.goal_amount ?? 0)}
              </div>
            </div>
          )}
          <span className="text-sm font-semibold mt-auto text-[var(--accent)]">후원하기 →</span>
        </div>
      </div>
    </Link>
  )
}
