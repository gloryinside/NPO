/**
 * 랜딩페이지 이미지 참조 추적 — 저장소 정리(orphan 삭제) 안전장치.
 *
 * 파일을 지워도 되는 조건: 초안·현재 게시본·게시 이력 어디에서도 참조하지 않을 때.
 * (예전 구현은 초안만 비교해, 초안에서 뺀 이미지를 게시 중인 페이지에서도 지웠다.)
 */
import type { LandingSection } from '@/types/landing'

export const LANDING_BUCKET = 'campaign-assets'

const IMAGE_RE = /\.(jpe?g|png|webp|gif|svg)(\?|$)/i

/** 섹션 데이터 전체(중첩 배열·객체 포함)를 훑어 이미지 URL을 모은다 */
export function collectImageUrls(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('http') && IMAGE_RE.test(value)) out.add(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collectImageUrls(v, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectImageUrls(v, out)
  }
  return out
}

/** 페이지 콘텐츠 JSON(초안·게시본·이력 스냅샷)에서 섹션 배열을 꺼낸다 */
export function sectionsOf(content: unknown): LandingSection[] {
  if (content && typeof content === 'object' && 'sections' in content) {
    const s = (content as { sections: unknown }).sections
    if (Array.isArray(s)) return s as LandingSection[]
  }
  return []
}

/** public URL → 저장소 경로 (campaign-assets/<path>) */
export function urlToStoragePath(url: string): string | null {
  try {
    const u = new URL(url)
    const marker = `/object/public/${LANDING_BUCKET}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(u.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

/**
 * 이전 초안에만 있던 이미지 중, 어디에서도 더는 쓰지 않는 파일의 저장소 경로.
 * 기관 접두사(<orgId>/landing/)가 아닌 파일은 절대 포함하지 않는다.
 */
export function orphanStoragePaths(
  orgId: string,
  prevDraft: unknown,
  keep: unknown[],
): string[] {
  const kept = new Set<string>()
  for (const c of keep) collectImageUrls(sectionsOf(c), kept)

  const paths: string[] = []
  for (const url of collectImageUrls(sectionsOf(prevDraft))) {
    if (kept.has(url)) continue
    const path = urlToStoragePath(url)
    if (path && path.startsWith(`${orgId}/landing/`) && !path.includes('..')) paths.push(path)
  }
  return paths
}
