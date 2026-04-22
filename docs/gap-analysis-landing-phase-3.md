# GAP 분석 — 랜딩 Phase 3 financials 보강 (2026-04-22)

Phase 2 financials 섹션 배포 후 발견된 3건 GAP(G-79/G-80/G-81)을 모두 해소.
이 세션은 **신규 variant 없이 기존 financials 품질 강화**에 집중.

---

## 이번 세션 해소 (3건)

### G-79. financials 자동 집계 API + 에디터 버튼

**신규:** `src/app/api/admin/finance/yearly-summary/route.ts`
- `GET /api/admin/finance/yearly-summary?year=YYYY`
- `payments` 테이블에서 `status = 'paid'` + `paid_at` 연도 범위 필터로 합계 계산
- 응답: `{ year, totalRaised, paidCount, note }`
- `requireAdminApi` 가드로 관리자만

**변경:** `FinancialsSummaryForm`, `FinancialsTransparencyForm`
- `총 모금액` 필드 아래에 **"🔄 {year}년 payments 자동 계산"** 버튼
- 클릭 → API 호출 → 결과를 `totalRaised`에 주입 + toast
- 연도가 설정된 경우에만 버튼 노출

**정책:** "참고값 — 확정 결산 후 수동 조정 권장" 문구를 응답 note에 포함. NPO 회계 특성상 실시간 합계는 참고용일 뿐 공시 값과 다를 수 있음을 명시.

### G-80. balance 정합성 경고

**신규 컴포넌트:** `BalanceMismatchWarning`
- `Math.abs(balance - (totalRaised - totalUsed)) / expected >= 0.1` 인 경우 배지 렌더
- 10% 이상 차이만 경고 — 이월금/이자/기부처 특이사항으로 인한 5% 미만 차이는 자연스러움
- `var(--warning)` 토큰 활용

**배치:** `FinancialsSummaryForm` 마지막에 렌더. 입력 시 즉시 반응.

### G-81. recharts 번들 분리 (dynamic import)

**변경:** `variant-components.tsx`
- `FinancialsBreakdown`, `FinancialsTimeline`만 `next/dynamic({ ssr: true })`로 분리
- `FinancialsSummary`, `FinancialsTransparency`는 recharts 미사용이라 즉시 import 유지

**효과:**
- financials-breakdown/timeline을 사용하지 않는 랜딩 페이지 → recharts 초기 JS payload에서 제외
- `ssr: true`(기본)로 SEO 유지, LCP 영향 없음
- `/admin/stats`는 별도 번들이므로 기존 사용과 무관

---

## Phase 3 이후 누적

| 범주 | 수치 |
|---|---|
| 섹션 타입 | 14 |
| Variants | 65 |
| 자동 집계 API | 1 (`yearly-summary`) |
| 동적 로드 variant | 2 (breakdown, timeline) |
| 테스트 | 79 passed |
| 빌드 | ✅ |
| 누적 해소 GAP | **G-1 ~ G-81 중 29+ 건** |

---

## 남은 방향 (다음 스프린트 후보)

### 우선순위 1 — 후원자 개인 임팩트 페이지
"당신의 10만원이 한 일" — 후원자 마이페이지에 개인화 임팩트 뷰:
- 누적 후원액 / 수혜자 수 추정 / 참여 캠페인 목록
- 기존 `financials-breakdown`과 유사한 도넛 차트를 "개인 버전"으로
- `/donor/impact` 신규 라우트

### 우선순위 2 — 관리자 대시보드 강화
- 이탈 위험 후원자 자동 이메일 알림 (cron + email-templates 재활용)
- 캠페인 목표 달성 시 자동 마감 처리
- `/admin/stats` 페이지 recharts 기반 시각화 추가

### 우선순위 3 — 랜딩 빌더 품질
- G-78 (스테이징 v1 회귀 검증 — 실제 배포 직전 이행)
- G-67 (team-org-chart 4+ 깊이) — 사용 데이터 누적 후 판단
- G-69 (testimonials-wall 순서) — 관리자 피드백 기반

---

## 프로덕션 기준선

현재 상태로 **프로덕션 배포 가능**. 이번 Phase 3 변경은 기존 Phase 2 financials 섹션을 쓰는 경우 즉시 이득, 안 쓰는 경우 영향 없음(단 recharts 번들 분리 덕에 초기 JS가 가벼워짐).

**체크리스트 반복** (기존 `gap-analysis-landing-final.md` §5 그대로 적용):
1. 스테이징 v1→v2 회귀 검증
2. 에디터 플로우
3. 썸네일 자동 생성
4. 성능/접근성
5. 데이터 무결성
