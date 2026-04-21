import type { LandingSection } from '@/types/landing'
import { findVariant } from './index'
import './register-all'  // 모든 variant를 registry에 등록

export interface ValidationIssue {
  sectionId: string
  variant: string
  error: string
}

/**
 * 각 섹션의 (type, variant, data)를 zod로 검증.
 * variant 미등록/타입 불일치/data 스키마 실패는 issues 배열로 반환.
 * legacy variant(예: 'campaigns-grid')는 레지스트리에 등록되지 않았으면 경고 대신 skip한다 —
 * Phase A에서 legacy 컴포넌트는 VARIANT_COMPONENTS에 직접 매핑되어 렌더되므로 스키마 검증 필요 없음.
 */
export function validateSections(sections: LandingSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const s of sections) {
    const descriptor = findVariant(s.variant)
    if (!descriptor) {
      // legacy default variants는 Phase A에서 스키마 검증 skip
      const legacyDefaults = new Set([
        'impact-alternating', 'campaigns-grid', 'tiers-cards',
        'team-grid', 'richtext-plain',
      ])
      if (legacyDefaults.has(s.variant)) continue
      issues.push({ sectionId: s.id, variant: s.variant, error: 'unknown_variant' })
      continue
    }
    if (descriptor.type !== s.type) {
      issues.push({ sectionId: s.id, variant: s.variant, error: 'type_variant_mismatch' })
      continue
    }
    const parsed = descriptor.dataSchema.safeParse(s.data)
    if (!parsed.success) {
      issues.push({
        sectionId: s.id,
        variant: s.variant,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
  }
  return issues
}
