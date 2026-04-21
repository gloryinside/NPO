'use client'
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useReducedMotion } from './useReducedMotion'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  delay?: number  // 초 단위 — framer-motion API와 호환 유지
}

/**
 * 스크롤 진입 시 fade-up. 이전엔 framer-motion 사용 → 경량화를 위해
 * IntersectionObserver + CSS transition으로 교체 (G-74).
 *
 * - reduced-motion 감지 시 즉시 표시 (transition 제거)
 * - viewport 20% 진입 시 1회만 reveal (framer-motion viewport.once 동일)
 * - delay는 framer-motion처럼 초 단위 (내부에서 ms 변환)
 */
export function MotionFadeUp({ children, delay = 0, style, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) { setVisible(true); return }
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.2 })

    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced])

  const baseStyle: React.CSSProperties = reduced
    ? style ?? {}
    : {
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
        willChange: visible ? 'auto' : 'opacity, transform',
      }

  return <div ref={ref} style={baseStyle} {...rest}>{children}</div>
}
