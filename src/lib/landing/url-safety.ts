/**
 * 랜딩 섹션 사용자 입력 URL 검증 — 저장형 XSS 방어(JobYLW 포털 url-safety 이식).
 *
 * 렌더 직전 한 곳(LandingRenderer)에서 섹션 데이터 전체를 훑어 정리한다.
 * 65개 variant 컴포넌트가 각자 검사하지 않아도 되게 하기 위함.
 */

/** 링크 href — http(s)·사이트 내부 경로·#앵커·mailto/tel만. javascript:/data: 등 차단 */
export function safeLinkUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const t = url.trim()
  if (!t) return null
  if (/^\/(?!\/)/.test(t)) return t // 내부 경로('//'는 프로토콜-상대 외부라 제외)
  if (/^#[\w-]*$/.test(t)) return t
  if (/^https?:\/\//i.test(t)) return t
  if (/^(mailto|tel):[^\s<>"']+$/i.test(t)) return t
  return null
}

/**
 * 이미지 src — http(s) 또는 내부 경로만. 확장자는 요구하지 않는다
 * (확장자 없는 CDN·변환 URL이 실제로 쓰이고, img src의 스킴만 막으면 스크립트 실행 경로가 없다).
 */
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const t = url.trim()
  if (!t) return null
  if (/^\/(?!\/)/.test(t)) return t.includes('..') || t.includes('\\') ? null : t
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:' ? t : null
  } catch {
    return null
  }
}

type UrlKind = 'image' | 'link' | null

const IMAGE_KEY = /(image|photo|logo|thumbnail|poster|avatar)Url$/i
const LINK_KEY = /(Url|href)$/

/** 필드 이름(+같은 객체의 다른 키)으로 URL 종류를 판정 */
function urlKind(key: string, siblings: Record<string, unknown>): UrlKind {
  if (IMAGE_KEY.test(key) || key === 'src') return 'image'
  // 갤러리 이미지는 { url, alt } — alt가 있으면 이미지, 그 밖의 url(로고 링크·후원 등급 링크)은 링크
  if (key === 'url') return 'alt' in siblings ? 'image' : 'link'
  if (key === 'videoUrl') return 'image' // http(s)만 통과 — 호스트 판정은 영상 컴포넌트가 따로 한다
  if (LINK_KEY.test(key)) return 'link'
  return null
}

/** 섹션 data를 깊게 복사하며 위험한 URL은 빈 문자열로 바꾼다 */
export function sanitizeSectionUrls<T>(data: T): T {
  return walk(data) as T
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk)
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const kind = typeof v === 'string' ? urlKind(k, obj) : null
    if (kind === 'image') out[k] = safeImageUrl(v) ?? ''
    else if (kind === 'link') out[k] = safeLinkUrl(v) ?? ''
    else out[k] = walk(v)
  }
  return out
}
