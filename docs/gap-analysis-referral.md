# GAP 분석 — Phase 5-B 초대/공유 프로그램 (2026-04-22)

Phase 5-A 임팩트 페이지에 이어 Phase 5-B에서 **후원자 초대 프로그램**을 추가했다.
지인에게 초대 코드를 공유하고, 초대로 가입한 회원의 후원 누적액을 확인할 수 있다.

---

## 구현 개요

### 1. 데이터 인프라

**신규 마이그레이션**: `20260422000003_referral_program.sql`
- 테이블: `referral_codes (id, org_id, member_id, code, created_at)`
- **전역 UNIQUE** 인덱스: `idx_referral_codes_code` — 코드는 테넌트 무관하게 유일
- **회원당 1개** 인덱스: `idx_referral_codes_member` — `member_id` UNIQUE
- CHECK 제약: `code = lower(code)`, `length BETWEEN 6 AND 16`
- `members.referrer_id UUID REFERENCES members(id) ON DELETE SET NULL` 추가
- 부분 인덱스: `idx_members_referrer WHERE referrer_id IS NOT NULL`

**코드 생성 규칙** (`src/lib/donor/referral.ts`)
- nanoid customAlphabet, 8자
- 알파벳 `23456789abcdefghjkmnpqrstuvwxyz` (혼동 문자 0/O/1/I/l 제거)
- UNIQUE 충돌(23505) 시 최대 3회 재시도 → 실패 시 `code_collision_exceeded`

### 2. 공용 lib (`src/lib/donor/referral.ts`)

4개 함수 + 10개 단위 테스트(`tests/unit/donor/referral.test.ts`, 10/10 passed):

- `getMemberReferralCode(supabase, memberId)` — 조회, 없으면 null
- `ensureReferralCode(supabase, orgId, memberId)` — idempotent 발급
- `findReferrerByCode(supabase, code)` — 코드 → `{memberId, orgId}`, 공백/미존재 시 null
- `getReferralStats(supabase, referrerMemberId)` — 초대 인원 + 각 회원의 paid 결제 합계

### 3. signup 플로우 통합

**변경**: `src/app/api/donor/link/route.ts`
- body에서 선택적 `referralCode` 파싱 (body 없어도 기존 플로우 유지)
- 3개 성공 분기(기존 연결 / idempotent / 새 연결)에 공용 `tryApplyReferrer(memberId)` 헬퍼 호출
- 검증 3단계 + DB 원자성:
  1. `findReferrerByCode` → null이면 skip
  2. `referrer.orgId !== tenant.id` → cross-tenant 차단
  3. `referrer.memberId === memberId` → self-referral 차단
  4. `UPDATE ... WHERE referrer_id IS NULL` → **기존 관계는 절대 덮어쓰지 않음** (레이스 안전)
- 추천 관계 설정 실패는 try/catch로 흡수 → 링크 주 흐름 보호

**변경**: `src/components/donor/signup-form.tsx`
- `?ref=코드` → sessionStorage 보관 + state 반영
- `POST /api/donor/link` body로 `{ referralCode }` 전달 (있을 때만)
- 성공 후 sessionStorage 키 정리
- 화면: 코드 적용 시 상단 배지 노출

### 4. 초대 프로그램 페이지

**신규 API**: `GET /api/donor/referral/code`
- `getDonorSession` 인증
- `rateLimit('referral:code:${memberId}', 10, 60_000)` — 분당 10회
- `ensureReferralCode` 호출 → `{ ok, code, createdAt }` 반환

**신규 페이지**: `/donor/invite`
- 서버 컴포넌트 — `ensureReferralCode` + `getReferralStats` 조합
- 초대 코드 + 초대 링크 복사 카드 (클라이언트 컴포넌트 `ReferralCodeCard`)
  - `navigator.clipboard.writeText` 복사 + 1.5초 피드백
  - `navigator.share` 있으면 우선, 없으면 링크 복사 fallback
  - 링크: `{origin}/donor/signup?ref={code}`
- 지표 2카드: 초대 성공 인원 / 초대한 후원자 누적 후원액
- 초대한 회원 목록 테이블: **이름 마스킹(김○○)** + 가입일 + 누적 후원액
- 빈 상태: "아직 내 코드로 가입한 분이 없습니다"

**네비게이션**: `donor-nav.tsx`에 "임팩트", "초대" 2개 링크 추가 (기존 임팩트 페이지 진입점도 함께 해소)

---

## 남은 리스크 (4건)

### 중간

#### G-101. 초대 중복 가입 방지 (동일 이메일 재사용)
- `members.referrer_id`는 `IS NULL`일 때만 업데이트하지만, 동일 이메일로 탈퇴-재가입 시나리오에서는 members 행이 이미 존재할 가능성 있음
- 현재 가드는 "referrer_id 미존재"일 때 한 번 성립 → 의도와 일치하지만, 악용 시 한 사람이 여러 계정으로 보상을 부풀릴 수 있음 (보상 체계 도입 전에는 영향 제한)
- **해결**: Phase 6에서 "초대 보상" 기능 붙일 때 members.email + referrer_id 결합 UNIQUE 정책 검토
- **우선순위**: 중간 (보상 도입 전까지는 저위험)

#### G-102. referral_codes RLS 미설정
- 마이그레이션에서 RLS policy를 명시하지 않았다 (admin service-role로만 접근하는 현재 구조 가정)
- donor 브라우저에서 직접 조회 경로는 없지만, 향후 donor 전용 API를 추가할 때 RLS 없이는 cross-tenant 노출 위험
- **해결**: `ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY` + `FOR SELECT USING (org_id = current_setting('app.tenant_id')::uuid)` 정책 추가 마이그레이션
- **우선순위**: 중간 (현재는 service-role 게이팅으로 보호)

### 낮음

#### G-103. 초대 링크 origin의 멀티테넌트 구분
- 현재 signup URL은 `{proto}://{host}/donor/signup?ref=...` — `x-forwarded-host`로 tenant 분기되는 현 proxy 구조 전제
- 외부 공유 시 수신자가 다른 tenant로 접근하면 코드가 조회되지만 `orgId` 검증으로 skip — 동작상 안전하나 UX 혼란 가능
- **해결**: invite 페이지 안내 문구에 "기관명"을 명시해 공유자가 올바른 맥락을 알 수 있게 함
- **우선순위**: 낮음 (검증은 서버에서 방어)

#### G-104. OTP-only 가입 플로우의 referral 미적용
- OTP 로그인 경로는 `/api/donor/link`를 거치지 않음 → 이 경로로 가입한 회원은 referralCode를 제출할 지점 없음
- **해결**: OTP 최초 로그인 시 server action 또는 별도 API로 ref 쿼리를 처리하는 흐름 추가
- **우선순위**: 낮음 (OTP 경로 이용 비중이 낮고, 재로그인 시 `/donor/invite`에서 공유 가능)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **114 passed** (+10 referral, 저장소 통합 테스트 2건 환경 실패는 무관) |
| 신규 마이그레이션 | 1 (`referral_program`) |
| 신규 lib | 1 (`donor/referral.ts`) |
| 신규 API | 1 (`/api/donor/referral/code`) |
| 수정 API | 1 (`/api/donor/link` — referralCode 처리) |
| 신규 페이지 | 1 (`/donor/invite`) |
| 신규 컴포넌트 | 1 (`ReferralCodeCard`) |
| 수정 컴포넌트 | 2 (signup-form, donor-nav) |
| 빌드 | 성공 |

---

## 다음 Phase 5 후보

Phase 5 원 계획(4개 하위 항목 중 2번 완료):
1. ✅ 임팩트 페이지 고도화 (5-A)
2. ✅ 초대/공유 프로그램 (5-B, 이번)
3. 정기후원 업그레이드/다운그레이드 플로우 (5-C)
4. 후원자 커뮤니티 — 응원 메시지 월 (5-D)

**다음 추천: 5-C 정기후원 업그레이드** — 초대로 유입된 신규 후원자의 라이프사이클 다음 단계를 잇는 자연스러운 흐름.
