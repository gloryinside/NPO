'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

interface Props {
  value: string
  durationMs?: number
}

/** 숫자가 포함된 문자열에서 숫자 부분만 추출해 0→N count up (scroll 진입 시 트리거) */
export function CountUp({ value, durationMs = 1600 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) { setShown(value); return }
    const match = value.match(/([\d,]+)/)
    if (!match) { setShown(value); return }
    const numStr = match[1].replace(/,/g, '')
    const target = parseInt(numStr, 10)
    if (!Number.isFinite(target)) { setShown(value); return }

    const prefix = value.slice(0, match.index)
    const suffix = value.slice((match.index ?? 0) + match[0].length)

    let raf = 0
    let startTs: number | null = null
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const tick = (ts: number) => {
        if (startTs === null) startTs = ts
        const p = Math.min((ts - startTs) / durationMs, 1)
        const ease = 0.5 - Math.cos(Math.PI * p) / 2
        const current = Math.round(target * ease)
        setShown(prefix + current.toLocaleString('ko-KR') + suffix)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })

    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(raf) }
  }, [value, durationMs, reduce])

  return <span ref={ref}>{shown}</span>
}
