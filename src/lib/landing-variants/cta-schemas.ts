import { z } from 'zod'

export const CtaBase = z.object({
  headline: z.string().min(1).max(100),
  body: z.string().max(300).optional(),
  buttonText: z.string().min(1).max(40),
  buttonUrl: z.string().max(500).optional(),
})

export const CtaBanner = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
})

export const CtaGradient = CtaBase.extend({
  gradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  gradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
})

export const CtaSplit = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  secondaryLabel: z.string().max(40).optional(),
  secondaryValue: z.string().max(80).optional(),
})

export const CtaUrgency = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  deadlineIso: z.string().datetime(),
  goalAmount: z.number().min(0).default(10_000_000),
  raisedAmount: z.number().min(0).default(0),
})

export const CtaFullscreen = CtaBase.extend({
  bgImageUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(55),
})

export type CtaBannerData = z.infer<typeof CtaBanner>
export type CtaGradientData = z.infer<typeof CtaGradient>
export type CtaSplitData = z.infer<typeof CtaSplit>
export type CtaUrgencyData = z.infer<typeof CtaUrgency>
export type CtaFullscreenData = z.infer<typeof CtaFullscreen>
