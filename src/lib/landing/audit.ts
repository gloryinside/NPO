/**
 * 게시 전 점검(JobYLW 포털 auditPortal 이식) — 순수 함수, 편집기에서 즉시 실행.
 *
 * 게시를 막지는 않는다(경고만). 관리자가 목록을 보고 확인 후 게시한다.
 * 특히 섹션 기본값에 남은 견본(picsum·placehold.co 이미지, 견본 영상)은
 * "에셋 필요" 검사(빈 칸만 봄)를 통과하므로 여기서 따로 잡는다.
 */
import type { LandingSection } from '@/types/landing'
import { SECTION_CATALOG } from '@/types/landing'
import { checkMissingAssets } from '@/lib/landing-variants/asset-check'
import { safeImageUrl, safeLinkUrl } from './url-safety'
import { parseSchedule, scheduleState } from './display'
import { kstToday } from '@/lib/billing/kst'

export type AuditCode = 'no_visible_sections' | 'missing_assets' | 'placeholder' | 'unsafe_url' | 'schedule_ended'

export interface AuditFinding {
  code: AuditCode
  sectionId: string | null
  message: string
}

/** 견본 콘텐츠 흔적 — 기본값에서 온 이미지·영상·문구 */
const PLACEHOLDER_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /picsum\.photos/i, what: '견본 사진(picsum)' },
  { re: /placehold\.co|via\.placeholder\.com|placeholder\.com/i, what: '견본 로고·이미지(placehold)' },
  { re: /dQw4w9WgXcQ/, what: '견본 영상 링크' },
  { re: /\bexample\.(com|org)\b/i, what: '예시 주소(example.com)' },
  { re: /lorem ipsum/i, what: '견본 문구(lorem ipsum)' },
]

function sectionLabel(s: LandingSection, index: number): string {
  const cat = SECTION_CATALOG.find((c) => c.type === s.type)
  return `${index + 1}번째 섹션(${cat?.label ?? s.type})`
}

/** 문자열 값을 모두 (키 이름과 함께) 꺼낸다 */
function* strings(value: unknown, key = ''): Generator<[string, string]> {
  if (typeof value === 'string') yield [key, value]
  else if (Array.isArray(value)) for (const v of value) yield* strings(v, key)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, k)
}

const URL_KEY = /(Url|href)$|^url$|^src$/

export function auditLanding(sections: LandingSection[], today: string = kstToday()): AuditFinding[] {
  const findings: AuditFinding[] = []
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const visible = ordered.filter((s) => s.isVisible)

  if (visible.length === 0) {
    findings.push({
      code: 'no_visible_sections',
      sectionId: null,
      message: '공개로 보이는 섹션이 없습니다. 게시하면 기본 소개 화면이 표시됩니다.',
    })
  }

  ordered.forEach((s, i) => {
    if (!s.isVisible) return // 숨긴 섹션은 공개되지 않으니 점검하지 않는다
    const label = sectionLabel(s, i)

    const sched = parseSchedule((s.data as Record<string, unknown>)?.schedule)
    if (scheduleState(sched, today) === 'ended') {
      findings.push({ code: 'schedule_ended', sectionId: s.id, message: `${label}는 보이는 기간이 끝나 공개되지 않습니다.` })
      return
    }

    if (checkMissingAssets(s).missing) {
      findings.push({ code: 'missing_assets', sectionId: s.id, message: `${label}에 비어 있는 이미지·영상이 있습니다.` })
    }

    const seen = new Set<string>()
    for (const [key, value] of strings(s.data)) {
      for (const p of PLACEHOLDER_PATTERNS) {
        if (p.re.test(value) && !seen.has(p.what)) {
          seen.add(p.what)
          findings.push({ code: 'placeholder', sectionId: s.id, message: `${label}에 ${p.what}이 남아 있습니다.` })
        }
      }
      if (URL_KEY.test(key) && value.trim() && !safeLinkUrl(value) && !safeImageUrl(value) && !seen.has('unsafe')) {
        seen.add('unsafe')
        findings.push({ code: 'unsafe_url', sectionId: s.id, message: `${label}에 허용되지 않는 주소가 있어 공개 페이지에서 비워집니다.` })
      }
    }
  })

  return findings
}
