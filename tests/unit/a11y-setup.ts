/**
 * G-95: a11y 테스트 전역 setup.
 * - toHaveNoViolations matcher 등록
 * - IntersectionObserver polyfill (MotionFadeUp, CountUp 등이 사용)
 * - matchMedia polyfill (useReducedMotion)
 */
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations as never)

// IntersectionObserver stub — 모든 엔트리를 "화면 내"로 간주해 fade-in 트리거
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class FakeIntersectionObserver {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds = []
  }
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
}

// matchMedia stub — prefers-reduced-motion 기본 false (애니메이션 on)
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
