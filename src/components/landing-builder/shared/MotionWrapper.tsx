'use client'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props extends HTMLMotionProps<'div'> {
  children: ReactNode
  delay?: number
}

/**
 * 스크롤 진입 시 fade-up. prefers-reduced-motion 존중 — 감지되면 즉시 표시.
 */
export function MotionFadeUp({ children, delay = 0, ...rest }: Props) {
  const reduce = useReducedMotion()
  if (reduce) {
    const { whileInView: _wi, initial: _i, animate: _a, transition: _t, viewport: _v, ...plain } = rest
    return <div {...(plain as unknown as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
