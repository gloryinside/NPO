'use client'
import { useReducedMotion } from 'framer-motion'

interface Props {
  imageUrl: string
  overlayOpacity: number   // 0~100
  enabled?: boolean
}

/**
 * 배경 이미지 + Ken Burns (느린 zoom/pan) + 그라디언트 오버레이.
 * reduced-motion 감지 시 애니메이션 비활성, 이미지는 유지.
 */
export function KenBurns({ imageUrl, overlayOpacity, enabled = true }: Props) {
  const reduce = useReducedMotion()
  const animate = enabled && !reduce
  const op = Math.max(0, Math.min(1, overlayOpacity / 100))
  const bg = `linear-gradient(to bottom, rgba(10,10,15,${op}), rgba(10,10,15,${Math.min(op + 0.3, 1)})), url(${JSON.stringify(imageUrl)})`
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={`absolute inset-0 bg-center bg-cover ${animate ? 'animate-ken-burns' : ''}`}
        style={{ backgroundImage: bg }}
      />
    </div>
  )
}
