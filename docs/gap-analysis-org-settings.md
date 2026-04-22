# GAP 분석 — 관리자 설정 UI (Phase 4-B, 2026-04-22)

Phase 4-A의 자동화를 기관별 설정으로 제어할 수 있도록 `orgs.settings` JSONB + 관리자 UI 추가.

---

## 구현 개요

### 1. 데이터 스키마

**마이그레이션**: `20260422000002_orgs_settings.sql`
- `orgs.settings JSONB NOT NULL DEFAULT '{}'`
- NULL 대신 빈 객체 기본값 — 읽기 시 lib에서 기본값 병합

**공용 lib**: `src/lib/org/settings.ts`
- 타입 `OrgSettings`: `weekly_alert_enabled`, `impact_unit_amount`, `campaign_thanks_enabled`
- `DEFAULT_ORG_SETTINGS`: `true / 100_000 / true`
- `getOrgSettings(supabase, orgId)`: DB 읽고 기본값 병합 + 안전 캐스팅 (0 이하 / 문자열 → 기본값)
- `updateOrgSettings(supabase, orgId, partial)`: 기존 값과 병합 후 저장 + `impact_unit_amount > 0` 검증
- 테스트 7건: 읽기 기본값, 병합, 타입 안전성, 업데이트 병합, 검증 실패, DB 에러

### 2. 자동화 통합

**notify-churn-risk** (`src/app/api/cron/notify-churn-risk/route.ts`):
- org별 settings 조회 → `weekly_alert_enabled === false` 면 skip
- 결과에 `error: 'opted_out'` 추가

**auto-close-campaigns** (`src/app/api/cron/auto-close-campaigns/route.ts`):
- goalReached에 `orgId` 포함
- 감사 이메일 발송 전 settings 조회 → `campaign_thanks_enabled === false` 면 skip
- 응답에 `thanksEmailsOptedOut` 카운터 추가

**/donor/impact** (`src/app/(donor)/donor/impact/page.tsx`):
- 기관 설정의 `impact_unit_amount` 우선 사용, 없으면 env 기반 fallback (`getImpactUnitAmount`)
- G-82 완전 해소

### 3. 관리자 API

**`/api/admin/settings/org-settings`**:
- `GET`: 현재 settings 반환 (기본값 병합된 상태)
- `PATCH`: 화이트리스트(3 필드)만 허용하는 부분 업데이트
  - 유효하지 않은 필드는 조용히 무시
  - 모든 필드가 없으면 400 `no_valid_fields`
  - `impact_unit_amount <= 0` 이면 400

### 4. 관리자 UI

**`OrgSettingsForm`** (`src/components/admin/org-settings-form.tsx`):
- 2개 토글: 주간 알림 / 캠페인 감사 이메일
- 숫자 입력: 임팩트 단가 (만원 단위 step)
- Optimistic update: 토글/저장 시 즉시 UI 반영 + 실패 시 rollback + toast
- role="switch" + aria-checked 접근성

**`/admin/settings` 페이지에 섹션 추가**:
- 기존 테마 설정 섹션 아래에 "알림·임팩트 설정" 섹션
- async server component `OrgSettingsFormSection`로 initial data 로드

---

## G-82 완전 해소 확인

Phase 3 GAP G-82 "임팩트 단가 설정화" 처리:
- 이전: 환경변수 `IMPACT_UNIT_AMOUNT` (전역)
- 현재: **기관별 `orgs.settings.impact_unit_amount` 우선** → env fallback → 100_000
- UI에서 관리자가 즉시 수정 가능
- 라벨도 동적(`5만원 단위` / `10만원 단위` 등)

---

## 남은 리스크 (3건)

### 중간

#### G-91. settings 업데이트가 바로 반영되지 않는 페이지 존재 가능성
- 공개 랜딩 `/?draft=1`이나 `/donor/impact`는 서버 컴포넌트라 settings 읽기 시 DB 왕복
- ISR/cache 없이 매 요청마다 쿼리 → 관리자가 설정 변경 시 즉시 반영 OK, 대신 성능 부담
- **해결**: React `cache()` 래핑으로 요청 내 중복 호출 1회로 제한 (이미 getOrgSettings 호출부는 페이지당 1회라 큰 문제 없음)
- **우선순위**: 중간 (성능 프로파일링 후 판단)

#### G-92. settings UI에서 "수신 이메일 변경" 링크 부재
- 관리자가 weekly_alert를 off 하지 않고 "contact_email만 바꾸고 싶다" 할 때
- `contact_email`은 기존 `OrgProfileForm`에 있음 — UI만 링크 추가하면 됨
- **해결**: OrgSettingsForm에 "수신 이메일: admin@org.com (변경 →)" 라벨
- **우선순위**: 중간 (UX 완성도)

### 낮음

#### G-93. settings 변경 감사 로그 부재
- 관리자 A가 toggle OFF → 문제 발생 시 누가 언제 끄었는지 추적 불가
- **해결**: `settings_change_log` 테이블 또는 기존 `admin_notifications` 활용
- **우선순위**: 낮음 (단일 관리자 기관 대다수)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **97 passed** (+7 settings) |
| 신규 마이그레이션 | 1 (`orgs.settings`) |
| 신규 lib | 1 (`org/settings`) |
| 신규 API | 1 (`/api/admin/settings/org-settings` GET/PATCH) |
| 신규 컴포넌트 | 1 (`OrgSettingsForm`) |
| 자동화 통합 | 3 (notify-churn-risk, auto-close, donor/impact) |
| 해소 GAP | **G-82 완전 해소** |

**Phase 4-B 완료. 프로덕션 배포 가능.**

---

## 다음 단계 후보 (Phase 4-C ~ 4-D)

1. **Phase 4-D — 성능/신뢰성** (추천)
   - G-87 auto-close N+1 쿼리 최적화
   - G-88 감사 이메일 실패 재시도 cron
   - G-89 리포트 recharts dynamic import
   - G-90 캠페인 목록에서 리포트 진입점
   - G-91 settings 캐싱
   - G-78 스테이징 v1 회귀 검증 (배포 직전)

2. **Phase 4-C — 후원자 engagement** (보류 추천)
   - 후원자 초대/공유 프로그램
   - 정기후원 업그레이드 플로우
   - 규모상 별도 스프린트 필요
