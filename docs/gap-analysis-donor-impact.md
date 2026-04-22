# GAP 분석 — 후원자 개인 임팩트 페이지 (2026-04-22)

Phase 3 세션 — 후원자 도메인 강화 첫 단계. `/donor/impact` 라우트와 집계 lib 추가.

---

## 구현 개요

### 신규 파일

| 파일 | 역할 |
|---|---|
| `src/lib/donor/impact.ts` | `getDonorImpact()` — payments 테이블에서 paid 결제만 합산, 캠페인별/연도별 집계 |
| `tests/unit/donor/impact.test.ts` | 6 테스트 (빈 상태, 단일 캠페인, 여러 캠페인 정렬, null campaign_id, 연도별 오름차순, activeMonths 개월 수) |
| `src/components/donor/impact/ImpactDonutChart.tsx` | recharts PieChart — 캠페인별 분포 |
| `src/components/donor/impact/ImpactYearlyBar.tsx` | recharts BarChart — 연도별 후원액 |
| `src/app/(donor)/donor/impact/page.tsx` | 서버 컴포넌트 페이지 (히어로 + 4카드 + 도넛 + 바 + 표 + CTA) |

### 변경 파일

- `src/app/(donor)/donor/page.tsx` — 마이페이지에 "✨ 나의 임팩트 →" 링크 추가 (accent 강조)

---

## 설계 결정

### 1. 집계 스코프
- **`pay_status = 'paid'` 만 합산** — 취소/환불/실패/pending 제외
- `pay_date` 기준 정렬 · 연도 분류 — `created_at` 대신 실제 결제일
- `campaigns(id, title)` 조인으로 캠페인명 표시. `campaign_id`가 null이면 "일반 후원"

### 2. 임팩트 추정 — "10만원 단위"
- 현재: `Math.floor(totalAmount / 100_000)`을 "지원 추정 건수"로 표시
- MVP 한계: 기관별 실제 단가가 다름 (교육지원 1인당 10만원 / 긴급구호 50만원 등)
- 개선 여지: `orgs.settings`에 `impact_unit_amount` 추가 → 관리자가 커스텀. **G-82**로 추적

### 3. 차트 렌더링
- Phase 2 financials와 동일한 recharts 재활용
- PieChart/BarChart는 이미 `next/dynamic`으로 분리되어 있지만, `/donor/impact`는 별도 라우트라 **해당 페이지 번들에만 포함**
- 마이페이지(`/donor`)는 여전히 recharts 제외 — 영향 최소화

### 4. 빈 상태 UX
- 결제 0건 시: 🌱 이모지 + "첫 후원으로 변화를 시작해보세요" + 캠페인 페이지 CTA
- 부정적 인상 없이 첫 후원 유도

### 5. 연도별 바 차트 조건
- `byYear.length >= 2` 일 때만 렌더 — 1년치 데이터는 막대 하나뿐이라 무의미
- 표는 1년치도 표시 (정보 손실 없음)

---

## 남은 리스크 (3건)

### 중간

#### G-82. 임팩트 추정 단가 하드코딩
- 현재 10만원 = 1건 고정
- **해결**: `orgs.settings.impact_unit_amount` (number, default 100_000) 추가. 관리자 설정 페이지에서 수정 가능하게. 기관별 표준 지원 단가 반영.
- **우선순위**: 중간 (설정만 바꾸면 즉시 반영)

#### G-83. 캠페인별 도넛 6개 초과 시 UX
- 현재 순위 리스트는 `slice(0, 6)`으로 자름. 차트는 전부 표시 → 7번째 이하가 "기타"로 표시되지 않고 조각 잘게 나뉨
- **해결**: 7번째부터 "기타"로 합쳐서 도넛과 리스트 모두 7개 구간. 또는 `Math.ceil(sqrt(N))`로 동적 설정
- **우선순위**: 중간 (후원 경력 긴 사용자)

### 낮음

#### G-84. 임팩트 페이지 캐시/성능
- `getDonorImpact`는 모든 결제 행을 SELECT — 후원 10년차 사용자라면 100+행
- 서버 컴포넌트라 매 요청마다 실행. Next.js `cache()` 또는 ISR `revalidate = 60` 으로 분당 1회 제한 가능
- **해결**: `revalidate = 300` (5분) + 새 결제 발생 시 `revalidatePath('/donor/impact')` 훅을 confirm/webhook에 추가
- **우선순위**: 낮음 (현재 결제 건수로는 문제 없음)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | 85 passed (79 + 6 impact) |
| `/donor/impact` 빌드 등록 | ✅ |
| 빌드 | 성공 |
| 신규 DB 테이블 | 0 (기존 payments 재사용) |
| 신규 API | 0 (페이지 서버 컴포넌트만) |

---

## 다음 Phase 3 하위 작업 후보

1. **G-82** 임팩트 단가 설정화 — 관리자 `/admin/settings` 페이지에 필드 추가
2. **G-83** "기타" 묶기 — 캠페인 7+ 대응
3. **관리자 대시보드 강화** (Phase 3 우선순위 2)
   - 이탈 위험 후원자 자동 이메일 (cron + email-templates)
   - 캠페인 목표 달성 시 자동 마감
4. **랜딩 빌더 품질 보강** (Phase 3 우선순위 3)
   - G-78 스테이징 회귀 검증 (배포 직전)
