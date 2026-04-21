import type {
  CtaBannerData, CtaGradientData, CtaSplitData, CtaUrgencyData, CtaFullscreenData,
} from './cta-schemas'

export const ctaBannerDefault = (): CtaBannerData => ({
  bgColor: '#1a3a5c',
  headline: '지금 바로 후원에 동참하세요',
  body: '작은 후원이 큰 변화를 만듭니다.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})

export const ctaGradientDefault = (): CtaGradientData => ({
  gradientFrom: '#1a3a5c',
  gradientTo: '#2563eb',
  headline: '지금 바로 후원에 동참하세요',
  body: '작은 후원이 큰 변화를 만듭니다.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})

export const ctaSplitDefault = (): CtaSplitData => ({
  bgColor: '#1a3a5c',
  headline: '함께해 주세요',
  body: '여러분의 참여가 기관을 움직입니다.',
  buttonText: '지금 후원하기',
  buttonUrl: '#campaigns',
  secondaryLabel: '전화 문의',
  secondaryValue: '02-000-0000',
})

export const ctaUrgencyDefault = (): CtaUrgencyData => {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return {
    bgColor: '#1a3a5c',
    headline: '마감 임박! 함께해 주세요',
    body: '목표 달성까지 얼마 남지 않았습니다.',
    buttonText: '지금 후원하기',
    buttonUrl: '#campaigns',
    deadlineIso: d.toISOString(),
    goalAmount: 10_000_000,
    raisedAmount: 6_400_000,
  }
}

export const ctaFullscreenDefault = (): CtaFullscreenData => ({
  bgImageUrl: 'https://picsum.photos/seed/cta-fs/1920/1080',
  overlayOpacity: 55,
  headline: '당신의 손길이 필요합니다',
  body: '지금 바로 동참해 주세요.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})
