/**
 * 랜딩 편집기 ↔ 미리보기 프레임 메시지(같은 출처 postMessage) — JobYLW 포털 빌더 방식 이식.
 * 받는 쪽은 출처·보낸 창을 확인하고, 형태를 검사한 메시지만 쓴다. 순수 함수.
 *
 * 저장(2초 debounce) 후 iframe을 새로 고치던 방식과 달리, 편집 중인 상태를 그대로 보내
 * 미리보기가 즉시 바뀌고, 미리보기에서 섹션을 누르면 편집기에서 그 섹션이 열린다.
 */
import type { LandingSection } from '@/types/landing'

export type PreviewState = {
  sections: LandingSection[]
  selectedId: string | null
  theme: 'light' | 'dark'
}

export type ToFrame = { kind: 'npo-landing-preview-state'; state: PreviewState }
export type FromFrame =
  | { kind: 'npo-landing-preview-ready' }
  | { kind: 'npo-landing-preview-select'; id: string }

const MAX_SECTIONS = 50
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** 프레임이 받은 메시지 → 미리보기 상태(형식이 틀리면 null) */
export function parseToFrame(raw: unknown): PreviewState | null {
  if (!isObj(raw) || raw.kind !== 'npo-landing-preview-state' || !isObj(raw.state)) return null
  const s = raw.state
  const sections: LandingSection[] = Array.isArray(s.sections)
    ? s.sections
        .flatMap((x, i) =>
          isObj(x) && typeof x.id === 'string' && typeof x.type === 'string' && typeof x.variant === 'string'
            ? [{
                id: x.id,
                type: x.type,
                variant: x.variant,
                sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : i,
                isVisible: x.isVisible !== false,
                data: isObj(x.data) ? x.data : {},
              } as LandingSection]
            : [],
        )
        .slice(0, MAX_SECTIONS)
    : []
  return {
    sections,
    selectedId: typeof s.selectedId === 'string' ? s.selectedId : null,
    theme: s.theme === 'dark' ? 'dark' : 'light',
  }
}

/** 편집기가 받은 메시지 → 프레임 이벤트(형식이 틀리면 null) */
export function parseFromFrame(raw: unknown): FromFrame | null {
  if (!isObj(raw)) return null
  if (raw.kind === 'npo-landing-preview-ready') return { kind: 'npo-landing-preview-ready' }
  if (raw.kind === 'npo-landing-preview-select' && typeof raw.id === 'string' && raw.id.length <= 100)
    return { kind: 'npo-landing-preview-select', id: raw.id }
  return null
}
