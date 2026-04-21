import type { z } from 'zod'
import type { LandingSectionType } from '@/types/landing'

export type VisualWeight = 'minimal' | 'bold' | 'cinematic'

/**
 * 각 variant가 쓰는 data 스키마는 variant별로 다르므로 타입은 unknown으로 두고,
 * 런타임에 zod(dataSchema)로 검증한다. Landing 섹션의 data 필드 타입이 v1 union인 관계로
 * 신규 variant(bgImageUrl, videoUrl 등)는 v1 union에 포함되지 않아 느슨한 타입으로 둔다.
 */
export interface VariantDescriptor {
  id: string
  type: LandingSectionType
  label: string
  description: string
  preview: string              // public 경로: /landing-variants/{id}.svg
  visualWeight: VisualWeight
  dataSchema: z.ZodSchema
  defaultData: () => unknown
}
