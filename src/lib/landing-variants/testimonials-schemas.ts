import { z } from 'zod'

const Testimonial = z.object({
  name: z.string().min(1).max(40),
  role: z.string().max(40).optional(),
  quote: z.string().min(1).max(400),
  photoUrl: z.string().url().optional(),
})

const VideoTestimonial = z.object({
  name: z.string().min(1).max(40),
  role: z.string().max(40).optional(),
  thumbnailUrl: z.string().url(),
  videoUrl: z.string().url(),
  quote: z.string().max(200).optional(),
})

export const TestimonialsCards = z.object({
  title: z.string().max(100).optional(),
  items: z.array(Testimonial).min(1).max(12),
})
export const TestimonialsCarousel = TestimonialsCards
export const TestimonialsWall = TestimonialsCards.extend({
  items: z.array(Testimonial).min(3).max(20),
})
export const TestimonialsQuoteLarge = z.object({
  title: z.string().max(100).optional(),
  items: z.array(Testimonial).min(1).max(6),
})
export const TestimonialsVideo = z.object({
  title: z.string().max(100).optional(),
  items: z.array(VideoTestimonial).min(1).max(9),
})

export type TestimonialsCardsData = z.infer<typeof TestimonialsCards>
export type TestimonialsCarouselData = z.infer<typeof TestimonialsCarousel>
export type TestimonialsWallData = z.infer<typeof TestimonialsWall>
export type TestimonialsQuoteLargeData = z.infer<typeof TestimonialsQuoteLarge>
export type TestimonialsVideoData = z.infer<typeof TestimonialsVideo>

const baseItems = () => ([
  { name: '김○○', role: '정기 후원자', quote: '작은 도움이 모여 큰 변화가 된다는 걸 직접 봤습니다.', photoUrl: 'https://i.pravatar.cc/150?img=1' },
  { name: '이○○', role: '일시 후원자', quote: '투명한 활동 보고가 신뢰를 주었습니다.', photoUrl: 'https://i.pravatar.cc/150?img=2' },
  { name: '박○○', role: '5년 정기 후원자', quote: '매달 작은 금액이지만 함께한다는 게 보람입니다.', photoUrl: 'https://i.pravatar.cc/150?img=3' },
])

export const testimonialsCardsDefault = (): TestimonialsCardsData => ({ title: '후원자 후기', items: baseItems() })
export const testimonialsCarouselDefault = (): TestimonialsCarouselData => ({ title: '후원자 후기', items: baseItems() })
export const testimonialsWallDefault = (): TestimonialsWallData => ({
  title: '따뜻한 응원의 목소리',
  items: [
    ...baseItems(),
    { name: '정○○', role: '봉사자', quote: '현장에서 직접 느낀 기관의 진정성을 믿습니다.' },
    { name: '최○○', role: '후원자 가족', quote: '가족 모두가 응원하고 있습니다.' },
  ],
})
export const testimonialsQuoteLargeDefault = (): TestimonialsQuoteLargeData => ({
  title: '후원자의 이야기',
  items: baseItems(),
})
export const testimonialsVideoDefault = (): TestimonialsVideoData => ({
  title: '후원자 영상 후기',
  items: [
    { name: '김○○', role: '정기 후원자', thumbnailUrl: 'https://picsum.photos/seed/tv1/600/400', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', quote: '직접 만나본 아이들의 미소를 잊을 수 없습니다.' },
    { name: '이○○', role: '봉사자', thumbnailUrl: 'https://picsum.photos/seed/tv2/600/400', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  ],
})
