import type { z } from 'zod'
import type { LandingSectionType, LandingSectionData } from '@/types/landing'

export type VisualWeight = 'minimal' | 'bold' | 'cinematic'

export interface VariantDescriptor {
  id: string
  type: LandingSectionType
  label: string
  description: string
  preview: string              // public 경로: /landing-variants/{id}.svg
  visualWeight: VisualWeight
  dataSchema: z.ZodSchema
  defaultData: () => LandingSectionData
}
