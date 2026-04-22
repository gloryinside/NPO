/**
 * Phase 6-A / G-109: 한국어 비속어 + 스팸 간이 필터.
 *
 * 설계 원칙:
 *   - 사전은 명백한 욕설 + 성적/폭력 표현 대표 소량만. 오탐 비용이 크므로 작게 시작.
 *   - 띄어쓰기/자모 분리 우회 방지를 위해 공백·특수문자 제거 후 비교.
 *   - 점수 기반 3단계 판정:
 *       clean (점수 0) → 즉시 공개
 *       suspicious (점수 1~3) → published=false로 저장, admin 승인 대기
 *       block (점수 ≥ 4) → 저장 자체를 거부
 *   - URL 5개 이상/같은 글자 10회 이상 반복 등 스팸 휴리스틱 포함.
 *
 * 이 모듈은 외부 API 없이 동작하므로 네트워크 실패나 비용 리스크 없음.
 * 정교한 OpenAI moderation / 전문 사전은 후속 Phase에서 교체 가능.
 */

// 대표 욕설/공격 표현 — 매치 시 +2점
// 완곡 우회(자모 분리) 형태까지 넣으면 오탐 급증하므로 완전한 형태만.
const HARD_WORDS: readonly string[] = [
  '씨발',
  '시발',
  '개새끼',
  '병신',
  '좆',
  '지랄',
  '니미',
  '닥쳐',
  '존나',
  '엿먹어',
  'fuck',
  'shit',
  'asshole',
]

// 의심 표현 — 매치 시 +1점 (혼자만 있으면 대기, 2개 이상이면 block)
const SOFT_WORDS: readonly string[] = [
  '바보',
  '멍청이',
  '쓰레기',
  '망해라',
  '사기',
  '꺼져',
]

export type ProfanityVerdict =
  | { verdict: 'clean'; score: 0 }
  | { verdict: 'suspicious'; score: number; reasons: string[] }
  | { verdict: 'block'; score: number; reasons: string[] }

/**
 * 비교용으로 공백·구두점 제거 + 소문자. 원문은 보존.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s.,!?~\-_/\\()[\]{}*'"`]/g, '')
}

export function analyzeProfanity(raw: string): ProfanityVerdict {
  const text = (raw ?? '').trim()
  if (!text) return { verdict: 'clean', score: 0 }

  const normalized = normalize(text)
  const reasons: string[] = []
  let score = 0

  for (const w of HARD_WORDS) {
    if (normalized.includes(normalize(w))) {
      score += 2
      reasons.push(`hard:${w}`)
    }
  }
  for (const w of SOFT_WORDS) {
    if (normalized.includes(normalize(w))) {
      score += 1
      reasons.push(`soft:${w}`)
    }
  }

  // 스팸 휴리스틱 — URL 5개 이상은 단독으로 block 임계값 도달
  const urlCount = (text.match(/https?:\/\//gi) ?? []).length
  if (urlCount >= 5) {
    score += 4
    reasons.push(`spam:urls=${urlCount}`)
  } else if (urlCount >= 3) {
    score += 1
    reasons.push(`spam:urls=${urlCount}`)
  }

  // 같은 문자 10회 이상 반복 (도배)
  if (/(.)\1{9,}/.test(text)) {
    score += 2
    reasons.push('spam:char_repeat')
  }

  // 같은 단어 5회 이상 반복
  const words = text.split(/\s+/).filter(Boolean)
  const freq = new Map<string, number>()
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  for (const [w, c] of freq) {
    if (c >= 5 && w.length >= 2) {
      score += 1
      reasons.push(`spam:word_repeat:${w}:${c}`)
      break
    }
  }

  if (score === 0) return { verdict: 'clean', score: 0 }
  if (score >= 4) return { verdict: 'block', score, reasons }
  return { verdict: 'suspicious', score, reasons }
}
