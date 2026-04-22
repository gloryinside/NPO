# GAP 분석 — Phase 7-A 운영 자동화 (2026-04-22)

Phase 6 완료 후 식별된 운영 마찰 3건:
**G-107(약정 변경 rate limit) + G-115(이메일 opt-out) + G-117(감사 이메일 debounce)**.

---

## 구현 개요

### 1. G-115 — 후원자 알림 수신 설정 (opt-out)

**신규 파일**:
- `supabase/migrations/20260422000006_members_notification_prefs.sql` — `members.notification_prefs JSONB NOT NULL DEFAULT '{}'` 컬럼 추가
- `src/lib/donor/notification-prefs.ts` — `parseNotificationPrefs / getNotificationPrefs / updateNotificationPrefs`
- `src/app/api/donor/notification-prefs/route.ts` — `GET / PATCH` 엔드포인트
- `src/app/(donor)/donor/settings/page.tsx` — Server Component, SSR 초기값 제공
- `src/components/donor/settings/NotificationPrefsForm.tsx` — Client Component, `useTransition` 토글 UI

**설계 결정**:
- JSONB 단일 컬럼 — 나중에 알림 종류가 늘어나도 스키마 변경 없이 키 추가만으로 확장
- 키 부재 = opt-in — 기존 회원 자동 마이그레이션 불필요. `parseNotificationPrefs`가 기본값 fallback
- `useTransition` 낙관적 업데이트 — 실패 시 롤백, 사용자에게 즉각 피드백

**변경**:
- `src/components/donor/donor-nav.tsx` — "설정" 링크 추가

### 2. G-117 — 감사 이메일 debounce (5분)

**변경**: `src/lib/email/notification-log.ts`
- `wasSentForRefWithin(supabase, refId, kind, minutesAgo)` 추가
- 같은 약정 ID + kind 기준 N분 내 발송 이력 존재 여부 조회

**변경**: `src/app/api/donor/promises/[id]/route.ts`
- `changeAmount` 액션에서 이메일 발송 전 5분 debounce 검사
- opt-out + debounce 모두 통과해야 발송 — 단락 평가로 DB 쿼리 최소화

### 3. G-107 — 약정 변경 rate limit (시간당 5회)

**변경**: `src/app/api/donor/promises/[id]/route.ts`
- `changeAmount` 진입 직후 `promise_amount_changes`에서 최근 1시간 내 `actor='member'` 변경 count 조회
- 5회 이상이면 HTTP 429 + `code: "RATE_LIMITED"` 반환
- 별도 Redis/캐시 불필요 — 이미 존재하는 이력 테이블 활용

---

## 구현 흐름 (changeAmount 요청 기준)

```
PATCH /api/donor/promises/[id] { action: "changeAmount", amount: N }
  ↓
① rate limit 검사 (1h / 5회 이상 → 429)
  ↓
② changePromiseAmount lib 호출 (DB 업데이트 + 이력 INSERT)
  ↓
③ direction === "same" → 이메일 스킵
③ opt-out (notification_prefs.amount_change = false) → 이메일 스킵
③ debounce (5분 내 동일 약정+kind 발송 이력) → 이메일 스킵
  ↓
④ 이메일 발송 + notification_log 기록
```

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **191 passed** (신규 8 — notification-prefs unit) |
| 변경 파일 | 7 |
| 신규 파일 | 6 (migration, lib, API route, page, component, docs) |
| 신규 API | 1 (`GET/PATCH /api/donor/notification-prefs`) |
| 마이그레이션 | 1 |
| 빌드 | 성공 |

---

## Phase 7-A 완료 선언

- ✅ **G-107**: 약정 변경 rate limit (시간당 5회 / member 기준)
- ✅ **G-115**: 후원자 알림 opt-out (notification_prefs JSONB + 설정 UI)
- ✅ **G-117**: 감사 이메일 debounce (5분 내 동일 약정 재발송 방지)

### 다음 후보

- **Phase 7-B — 공유 깊이**: G-118(카톡 미리보기) / G-119(이미지 저장 버튼)
- **Phase 7-C — 데이터 의무**: G-101(초대 보상 악용 방지) / G-102(referral_codes RLS) / G-116(ISR 즉시 무효화)
