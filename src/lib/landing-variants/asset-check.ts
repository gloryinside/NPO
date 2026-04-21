import type { LandingSection } from '@/types/landing'
import { findVariant } from './index'

/**
 * variant별 "있어야 할 에셋 필드" 매핑.
 * cinematic/bold variant가 특정 이미지/비디오 에셋 없이 저장되면 UX가 깨지므로 경고한다.
 */
const REQUIRED_ASSETS: Record<string, string[]> = {
  // hero
  'hero-split-image': ['rightImageUrl'],
  'hero-fullscreen-image': ['bgImageUrl'],
  'hero-fullscreen-video': ['videoUrl', 'posterUrl'],
  'hero-gallery': ['images'],  // 배열
  'hero-stats-overlay': ['bgImageUrl'],
  // cta
  'cta-fullscreen': ['bgImageUrl'],
  // testimonials
  'testimonials-video': ['items'],  // 각 item의 thumbnailUrl/videoUrl
  // impact
  'impact-storytelling': ['blocks'],  // 각 block의 imageUrl
  'impact-before-after': ['blocks'],
  'impact-cards': ['blocks'],
  // logos (모든 variant)
  'logos-grid': ['logos'],
  'logos-marquee': ['logos'],
  'logos-press': ['logos'],
  'logos-partners': ['logos'],
  // timeline-milestones
  'timeline-milestones': ['events'],
  // gallery (모든 variant)
  'gallery-grid': ['images'],
  'gallery-masonry': ['images'],
  'gallery-lightbox': ['images'],
  'gallery-carousel': ['images'],
  'gallery-fullbleed': ['images'],
}

/**
 * section의 variant에 필수 에셋이 빈 상태인지 검사.
 * 빈 문자열 / 빈 배열 / 배열 내 빈 url 모두 감지.
 */
export function checkMissingAssets(section: LandingSection): {
  missing: boolean
  fields: string[]
  visualWeight: 'minimal' | 'bold' | 'cinematic' | null
} {
  const descriptor = findVariant(section.variant)
  const required = REQUIRED_ASSETS[section.variant] ?? []
  if (required.length === 0) {
    return { missing: false, fields: [], visualWeight: descriptor?.visualWeight ?? null }
  }
  const data = section.data as Record<string, unknown>
  const missingFields: string[] = []

  for (const key of required) {
    const v = data[key]
    if (v === undefined || v === null || v === '') {
      missingFields.push(key)
      continue
    }
    // 배열인 경우 (images/blocks/items/logos/events)
    if (Array.isArray(v)) {
      if (v.length === 0) {
        missingFields.push(key)
        continue
      }
      // 배열 내 각 객체에 핵심 url 필드가 비어 있는지 검사
      const hasBlank = v.some((item) => {
        if (!item || typeof item !== 'object') return true
        const o = item as Record<string, unknown>
        // 주요 url 키들 (하나라도 비어 있으면 경고)
        const urlKeys = ['url', 'imageUrl', 'thumbnailUrl', 'videoUrl', 'beforeImageUrl', 'afterImageUrl']
        return urlKeys.some((k) => k in o && (o[k] === '' || o[k] === null))
      })
      if (hasBlank) missingFields.push(key)
    }
  }

  return {
    missing: missingFields.length > 0,
    fields: missingFields,
    visualWeight: descriptor?.visualWeight ?? null,
  }
}
