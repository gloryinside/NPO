# GAP 분석 — Phase 4-E 배포 준비 완성 (2026-04-22)

Phase 4-D까지 미처리된 G-94/G-95/G-96을 한 세션에 해소. 프로덕션 배포 전 최종 하드닝.

---

## 해소 요약

### G-95 — jest-axe a11y 자동 테스트

**도입**:
- `jest-axe` + `@types/jest-axe` 설치
- `tests/unit/a11y-setup.ts` — vitest에서 `toHaveNoViolations` matcher 등록 + jsdom stub
  - IntersectionObserver (MotionFadeUp 등이 사용)
  - matchMedia (useReducedMotion)
- `vitest.config.ts`의 unit project에 `setupFiles` 연결 → 모든 unit 테스트가 자동으로 stub 로드

**스모크 테스트**: `tests/unit/a11y/landing-variants.test.tsx`
- 각 시각적 weight/섹션 타입을 대표하는 6개 variant:
  - HeroMinimal (minimal)
  - CtaBanner (minimal)
  - StatsGrid (minimal)
  - TestimonialsCards (minimal)
  - FaqAccordion (minimal)
  - FinancialsSummary (minimal)
- 모두 axe-core에서 **WCAG 위반 0** 확인

**향후 확장**:
- bold/cinematic variant도 점진 추가 (현재 minimal만)
- `/admin/campaigns/[id]/report` 같은 복잡 페이지는 RTL로 server component 래핑이 복잡해 차기 스프린트로

### G-94 — Lighthouse 측정 스크립트

**신규**: `scripts/lighthouse-check.mjs` + `npm run lighthouse`
- 로컬 `next start`된 서버를 대상으로 headless Chrome 실행
- 대상: `/` 랜딩 홈, `/donor/login` 2개
- 측정: Performance / A11y / Best Practices / SEO + LCP/CLS/TBT
- 결과: `lighthouse-reports/{name}.json` + `{name}.summary.json`

**사용 흐름**:
```bash
npm run build
npm run start     # 별도 터미널
npm run lighthouse
```

**목표 수치** (spec §8.5):
- LCP < 2500ms
- CLS < 0.1
- Performance ≥ 80

**미실측 상태** — CI 연동이나 Vercel Speed Insights는 별도 작업. 이 스크립트는 로컬 수동 확인용.

### G-96 — 실패 이메일 수동 재전송 UI

**API 2개**:
- `GET /api/admin/notifications/failed` — 30일 내 failed 로그 + 중복 조합 dedupe + sent 있는 조합 제외
- `POST /api/admin/notifications/retry` — `{ logId }` 기반 단일 재전송
  - tenant isolation 체크
  - 이미 sent 상태면 400
  - 현재는 `campaign_closed_thanks`만 지원 (가장 흔한 재전송 대상)

**UI**: `FailedEmailsWidget`
- `/admin/settings` 하단 "최근 실패한 자동화 이메일" 섹션에 배치
- 각 행: 이메일 종류 / 수신자 / 발송 시각 / 에러 메시지
- 재전송 버튼: loading 상태 + toast + 성공 시 자동 새로고침
- 주간 알림은 수동 재전송 미지원 (disabled) — 주간 cron이 알아서 다음 주 재시도

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **103 passed** (+6 a11y) |
| 신규 API | 2 (`failed`, `retry`) |
| 신규 컴포넌트 | 1 (`FailedEmailsWidget`) |
| 신규 스크립트 | 1 (`lighthouse-check.mjs`) |
| vitest setup | 1 (`a11y-setup.ts`) |
| 빌드 | 성공 |

---

## 프로덕션 배포 체크리스트 (최종)

### 완료 항목
- [x] 14 섹션 × 65 variants 랜딩 빌더
- [x] 자동화 cron 4개 (churn-risk, auto-close, retry-failed, cancel-stale)
- [x] 기관별 설정 UI (`orgs.settings`)
- [x] 후원자 개인 임팩트 페이지 (`/donor/impact`)
- [x] 캠페인 종료 리포트 (`/admin/campaigns/[id]/report`)
- [x] 실패 이메일 수동 재전송 UI
- [x] a11y 자동 테스트 (6 스모크)
- [x] Lighthouse 측정 스크립트
- [x] recharts dynamic import (번들 최적화)
- [x] N+1 쿼리 제거 (auto-close batch)
- [x] settings React cache (요청 내 DB 왕복 감소)

### 배포 직전 확인 필요
- [ ] **vercel.json crons 추가** (4개 cron + CRON_SECRET 환경변수)
- [ ] **SMTP 환경변수** 프로덕션 세팅 (notify-churn-risk, auto-close 감사 이메일용)
- [ ] **supabase 마이그레이션 적용**: `email_notifications_log`, `orgs.settings`
- [ ] **스테이징 v1 회귀 검증** (G-78) — 기존 발행 페이지가 v2 마이그레이션으로 깨지지 않는지
- [ ] **Lighthouse 실측 수치 기록** — 목표치 미달 시 G-94 follow-up
- [ ] **프로덕션 `IMPACT_UNIT_AMOUNT` 환경변수** (기관별 settings가 없는 기본값)

---

## 남은 Low-Priority 항목 (프로덕션 진입 후 개선 가능)

| # | 내용 |
|---|---|
| G-67 | team-org-chart 4+ 깊이 (규모 따라) |
| G-69 | testimonials-wall 순서 (관리자 피드백 후) |
| G-73 | 실렌더 썸네일 Playwright 자동 생성 (CI 연동) |
| G-85 (재확인) | notifications 중복 방지 7일 정책 실측 |
| G-92 | 수신 이메일 변경 링크 |
| G-93 | settings 변경 감사 로그 (다중 관리자 환경) |

---

## 다음 방향 후보

1. **Phase 5 — 후원자 engagement** (이전 Phase 4-C 보류)
   - 후원자 초대/공유 프로그램
   - 정기후원 업그레이드 플로우
   - 후원자 커뮤니티 기능
2. **Phase 5' — 하드닝 지속**
   - CI에 Lighthouse 연동 (성능 회귀 자동 감지)
   - a11y 테스트 bold/cinematic variant 확장
   - G-78 스테이징 검증 후 실제 배포 수행

**프로덕션 배포 가능 상태 — 스테이징 검증만 남음.**
