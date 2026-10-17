/**
 * 섹션 표시 설정 — JobYLW 포털 빌더의 스타일 프리셋·보이는 기간 이식(순수 함수).
 * section.data.style / section.data.schedule 에 저장(스키마 변경 없음).
 *
 * NPO 섹션은 화면 폭 전체를 쓰고 스스로 배경을 칠한다. 그래서 테마는 배경 클래스를 덧씌우지 않고
 * 래퍼 안에서 디자인 토큰(--bg, --surface, --text …)을 바꿔 섹션이 알아서 따라 칠하게 한다(globals.css).
 * 자유 hex·px는 받지 않는다 — 기관 디자인 일관성 + 저장값으로 CSS를 주입할 여지 차단.
 */

export type SectionTheme = 'default' | 'highlight' | 'dark' | 'brand'
export type SectionSpacing = 'none' | 'sm' | 'md' | 'lg'
export type SectionDisplay = { theme: SectionTheme; spacing: SectionSpacing }
export type Schedule = { from?: string; until?: string }
export type ScheduleState = 'always' | 'upcoming' | 'active' | 'ended'

export const DEFAULT_DISPLAY: SectionDisplay = { theme: 'default', spacing: 'none' }

const THEMES: SectionTheme[] = ['default', 'highlight', 'dark', 'brand']
const SPACINGS: SectionSpacing[] = ['none', 'sm', 'md', 'lg']
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function pick<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}

export function parseDisplay(raw: unknown): SectionDisplay {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { theme: pick(o.theme, THEMES, 'default'), spacing: pick(o.spacing, SPACINGS, 'none') }
}

export function parseSchedule(raw: unknown): Schedule {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Schedule = {}
  if (typeof o.from === 'string' && YMD.test(o.from)) out.from = o.from
  if (typeof o.until === 'string' && YMD.test(o.until)) out.until = o.until
  // 끝이 시작보다 앞이면 기간 무효 — 끝만 버린다(항상 안 보이는 섹션 방지)
  if (out.from && out.until && out.until < out.from) delete out.until
  return out
}

/** today = 한국 날짜 YYYY-MM-DD (시작·끝 당일 포함) */
export function scheduleState(s: Schedule, today: string): ScheduleState {
  if (!s.from && !s.until) return 'always'
  if (s.from && today < s.from) return 'upcoming'
  if (s.until && today > s.until) return 'ended'
  return 'active'
}

/** 공개 화면·미리보기에 그릴지 — 켜져 있고 오늘이 기간 안 */
export function shownOn(section: { isVisible: boolean; data: unknown }, today: string): boolean {
  if (!section.isVisible) return false
  const data = (section.data ?? {}) as Record<string, unknown>
  const st = scheduleState(parseSchedule(data.schedule), today)
  return st === 'always' || st === 'active'
}

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

/** 편집기 목록 배지 — 기간이 없으면 null */
export function scheduleLabel(s: Schedule, today: string): string | null {
  switch (scheduleState(s, today)) {
    case 'always':
      return null
    case 'upcoming':
      return `예약 · ${md(s.from!)}부터`
    case 'ended':
      return `기간 끝남 · ${md(s.until!)}`
    case 'active':
      return s.until ? `${md(s.until)}까지` : `${md(s.from!)}부터`
  }
}

const SPACING_CLASS: Record<SectionSpacing, string> = { none: '', sm: 'py-4', md: 'py-8', lg: 'py-14' }

/** 래퍼 속성 — 테마는 data 속성(토큰 재정의는 globals.css), 여백은 클래스 */
export function displayAttrs(d: SectionDisplay): { className: string; 'data-section-theme'?: SectionTheme } {
  return {
    className: SPACING_CLASS[d.spacing],
    ...(d.theme !== 'default' ? { 'data-section-theme': d.theme } : {}),
  }
}

/** 저장 전 정리 — 허용값만 남긴다(서버 PATCH·게시에서 호출) */
export function normalizeDisplayFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data }
  if ('style' in out) {
    const d = parseDisplay(out.style)
    if (d.theme === 'default' && d.spacing === 'none') delete out.style
    else out.style = d
  }
  if ('schedule' in out) {
    const s = parseSchedule(out.schedule)
    if (!s.from && !s.until) delete out.schedule
    else out.schedule = s
  }
  return out as T
}

export const DISPLAY_OPTIONS = {
  theme: [
    { value: 'default', label: '기본' },
    { value: 'highlight', label: '강조(연회색)' },
    { value: 'dark', label: '딥네이비' },
    { value: 'brand', label: '브랜드(연녹색)' },
  ],
  spacing: [
    { value: 'none', label: '없음' },
    { value: 'sm', label: '좁게' },
    { value: 'md', label: '보통' },
    { value: 'lg', label: '넓게' },
  ],
} as const
