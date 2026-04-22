import { Badge } from '@/components/ui/badge'
import type { AccountState } from '@/lib/members/account-state'

/**
 * Phase 7-D-1: 회원/비회원 + 초대 상태 뱃지.
 *
 * 4가지 상태에 대해 색·라벨·설명 조합을 하나의 presentation 컴포넌트로 묶는다.
 * 목록·상세·프로필 어디서든 같은 시각 언어를 유지하기 위함.
 */

interface Props {
  state: AccountState
  /** 작은 목록 뱃지 모드 — 기본 false면 full label */
  compact?: boolean
}

const STYLES: Record<AccountState, React.CSSProperties> = {
  linked: { background: 'var(--positive-soft)', color: 'var(--positive)' },
  invited: {
    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    color: 'var(--accent)',
  },
  invite_expired: {
    background: 'var(--warning-soft)',
    color: 'var(--warning)',
  },
  unlinked: {
    background: 'rgba(136,136,170,0.15)',
    color: 'var(--muted-foreground)',
  },
}

export function AccountStateBadge({ state, compact = false }: Props) {
  // unlinked/invited/invite_expired 모두 "비회원"이라는 1차 라벨 + 보조 뱃지 조합
  if (state === 'linked') {
    return (
      <Badge style={STYLES.linked} className="border-0 font-medium">
        회원
      </Badge>
    )
  }

  const baseBadge = (
    <Badge style={STYLES.unlinked} className="border-0 font-medium">
      비회원
    </Badge>
  )

  if (state === 'unlinked') return baseBadge

  const subLabel = state === 'invited' ? '초대됨' : '초대 만료'
  const subStyle = STYLES[state]

  return (
    <span className={compact ? 'inline-flex gap-1' : 'inline-flex gap-1.5'}>
      {baseBadge}
      <Badge style={subStyle} className="border-0 font-medium">
        {subLabel}
      </Badge>
    </span>
  )
}
