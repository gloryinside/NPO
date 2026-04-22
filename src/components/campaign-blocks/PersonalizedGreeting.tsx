'use client'

import { useEffect, useState } from 'react'

/**
 * Tier A #9: URL 파라미터 맞춤 인사.
 *
 * `?name=홍길동` 접속 시 "홍길동 님, 아이들의 내일을 함께해주세요" 같은 메시지 표시.
 * 이름이 없거나 유효하지 않으면 렌더링 안 함.
 *
 * XSS 방지: 이름은 2-20자 한글/영문/공백만 허용.
 */
const NAME_REGEX = /^[가-힣A-Za-z\s]{2,20}$/

export function PersonalizedGreeting({ campaignTitle }: { campaignTitle: string }) {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const raw = params.get('name')?.trim() ?? ''
      if (!raw) return
      if (!NAME_REGEX.test(raw)) return
      setName(raw)
    } catch {
      // SSR 방어
    }
  }, [])

  if (!name) return null

  // 존칭 생략: "길동 님" 형태로 (한국식 친근감)
  // 2글자 이상이면 성+이름으로 가정. 이름만 쓸 수도 있으므로 그대로 사용.
  const displayName = name

  return (
    <div className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
      <p className="text-base font-medium text-[var(--accent)]">
        {displayName} 님, {campaignTitle}에 함께해주셔서 감사합니다.
      </p>
      <p className="mt-1 text-sm text-[var(--text)]">
        작은 정성이 큰 변화를 만듭니다. 지금 후원에 동참해 주세요.
      </p>
    </div>
  )
}
