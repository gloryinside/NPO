'use client'
import { useEffect, useState } from 'react'

/**
 * framer-motion을 대체하는 경량 useReducedMotion.
 * prefers-reduced-motion media query를 구독하고 현재 값을 반환.
 * SSR 시에는 false (애니메이션 on) 로 초기화 — hydration 직후 클라이언트에서 MQ 확인.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
