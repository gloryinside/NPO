import { z } from 'zod'

const TeamMember = z.object({
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(60),
  bio: z.string().max(300).optional(),
  photoUrl: z.string().url().optional(),
  parent: z.string().max(40).optional(),   // org-chart용 상위 노드 name
})

export const TeamBase = z.object({
  title: z.string().max(100).optional(),
  members: z.array(TeamMember).min(1).max(30),
})

export const TeamGrid = TeamBase
export const TeamCards = TeamBase
export const TeamFeatured = TeamBase
export const TeamCarousel = TeamBase
export const TeamOrgChart = TeamBase

export type TeamBaseData = z.infer<typeof TeamBase>

const baseMembers = () => ([
  { name: '홍길동', role: '대표이사', bio: '20년간 사회복지 분야에 헌신해왔습니다.', photoUrl: 'https://i.pravatar.cc/200?img=10' },
  { name: '김지원', role: '사무국장', bio: '비영리 운영 전문가로 기관을 이끌고 있습니다.', photoUrl: 'https://i.pravatar.cc/200?img=11', parent: '홍길동' },
  { name: '이수진', role: '프로그램 매니저', bio: '현장 사업 총괄.', photoUrl: 'https://i.pravatar.cc/200?img=12', parent: '김지원' },
  { name: '박민호', role: '운영팀장', bio: '기관 운영 지원.', photoUrl: 'https://i.pravatar.cc/200?img=13', parent: '김지원' },
])

export const teamGridDefault = (): TeamBaseData => ({ title: '함께하는 사람들', members: baseMembers() })
export const teamCardsDefault = (): TeamBaseData => ({ title: '우리 팀', members: baseMembers() })
export const teamFeaturedDefault = (): TeamBaseData => ({ title: '리더십', members: baseMembers() })
export const teamCarouselDefault = (): TeamBaseData => ({ title: '우리 팀', members: baseMembers() })
export const teamOrgChartDefault = (): TeamBaseData => ({ title: '조직 구성', members: baseMembers() })
