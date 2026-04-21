import type { LandingSectionType } from '@/types/landing'
import type { VariantDescriptor } from './types'

const registry: Partial<Record<LandingSectionType, VariantDescriptor[]>> = {}

export function registerVariants(type: LandingSectionType, variants: VariantDescriptor[]) {
  registry[type] = [...(registry[type] ?? []), ...variants]
}

export function getVariants(type: LandingSectionType): VariantDescriptor[] {
  return registry[type] ?? []
}

export function findVariant(variantId: string): VariantDescriptor | undefined {
  for (const variants of Object.values(registry)) {
    const match = variants?.find((v) => v.id === variantId)
    if (match) return match
  }
  return undefined
}

// 구체 variant 파일들 import (side-effect: registerVariants 호출)
import './hero'
import './cta'
import './stats'
