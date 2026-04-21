import { z } from 'zod'

const StatItem = z.object({
  icon: z.string().max(4).optional(),
  value: z.string().min(1).max(20),
  label: z.string().min(1).max(40),
})

export const StatsBase = z.object({
  title: z.string().max(100).optional(),
  items: z.array(StatItem).min(2).max(6),
})

export const StatsGrid = StatsBase
export const StatsInline = StatsBase
export const StatsCards = StatsBase
export const StatsCountup = StatsBase
export const StatsBig = StatsBase.extend({
  gradient: z.boolean().default(true),
})

export type StatsGridData = z.infer<typeof StatsGrid>
export type StatsInlineData = z.infer<typeof StatsInline>
export type StatsCardsData = z.infer<typeof StatsCards>
export type StatsCountupData = z.infer<typeof StatsCountup>
export type StatsBigData = z.infer<typeof StatsBig>
