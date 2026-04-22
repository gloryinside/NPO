# GAP 분석 — Phase 7-C 데이터 의무 (2026-04-22)

Phase 7-A 운영 자동화(G-107/G-115/G-117) 완료 후 식별된 3건 중
즉시 영향이 있는 **G-116(ISR 즉시 무효화) + G-102(referral_codes donor RLS)**를 해소.
G-101(초대 보상 악용 방지)은 보상 체계 미도입 상태라 보류.

---

## 구현 개요

### 1. G-116 — 응원 메시지 변경 시 ISR 즉시 무효화

**배경**: `/campaigns/[slug]` 공개 페이지는 `revalidate = 60` ISR.
후원자 본인 삭제/관리자 숨김 후에도 최대 60초 동안 이전 응원 벽이 노출됨.
`/donor/cheer`에서 "삭제했는데 왜 보여요?"라는 UX 혼란 가능.

**신규 파일**: `src/lib/cheer/revalidate.ts`
- `revalidateCheerCampaignPath(supabase, cheerId)` 헬퍼
- cheer row → `campaign_id` → `campaigns.slug` 조회 후 `revalidatePath('/campaigns/{slug}')`
- best-effort: 조회 실패/슬러그 없음/`revalidatePath` 예외 모두 try/catch로 흡수 — 주 API 흐름 보호
- **왜 `revalidateTag`가 아닌 `revalidatePath`?**: CheerWall은 Supabase SDK 직호출로 렌더되며 `fetch` tag가 붙어 있지 않다. 기존 `lib/donations/confirm.ts`의 `campaign:{slug}` tag는 캠페인 본문 fetch용이라 cheer 변경과 커플링 불필요 — 정확히 영향받는 경로만 무효화한다.

**연결 지점**:
- `POST /api/cheer` — 공개 상태(`published=true`)로 저장된 경우만 무효화
- `DELETE /api/donor/cheer/[id]` — soft-delete 후 무효화
- `PATCH /api/admin/cheer/[id]` — hidden/published 토글 시 무효화

**안전성**:
- 캠페인 없는 "일반 응원"(`campaign_id IS NULL`)은 공개 경로가 아직 없어 skip
- suspicious로 `published=false` 저장 시 벽에 안 보이므로 발송 스킵 → 재공개 시점(admin PATCH)에 무효화

### 2. G-102 — referral_codes donor 본인 SELECT RLS

**배경**: `referral_codes`는 이미 `ENABLE ROW LEVEL SECURITY` + admin SELECT 정책이 있으나, donor 본인이 직접 SELECT하는 경로의 정책은 없었다. 현재는 모든 donor 조회가 service-role API(`ensureReferralCode`)를 경유해 문제가 없지만, 향후 클라이언트-사이드 Supabase JS로 직접 조회 시 차단됨.

**신규 마이그레이션**: `20260422000007_referral_codes_donor_rls.sql`
```sql
CREATE POLICY referral_codes_donor_own_read
  ON referral_codes FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid())
  );
```

**경계 명확화**:
- SELECT만 허용 — INSERT/UPDATE/DELETE는 여전히 service-role 전용
- `ensureReferralCode`의 충돌 재시도/coin-flip 로직을 클라이언트 쪽에 유출하지 않기 위함

---

## 남은 리스크 (1건, 보류)

#### G-101. 초대 중복 가입 방지 (동일 이메일 재사용)
- 현재 `members.referrer_id`는 `IS NULL` 가드로 cross-write 방지되지만, 동일 이메일 탈퇴-재가입 시나리오로 1인이 여러 계정에서 보상을 부풀릴 수 있음
- **보류 사유**: 초대 보상 체계가 아직 기획 단계. 보상 도입 시 `members.email + referrer_id` UNIQUE 정책 + `referral_bonus_grants` 테이블 이벤트 추적이 더 근본적 해법

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **166 unit passed** (신규 lib는 best-effort try/catch — 유닛 추가 없이 호출부 통합 검증) |
| 변경 파일 | 3 (`cheer/route.ts`, `admin/cheer/[id]/route.ts`, `donor/cheer/[id]/route.ts`) |
| 신규 파일 | 2 (lib `cheer/revalidate.ts`, migration `referral_codes_donor_rls.sql`) |
| 신규 API | 0 |
| 마이그레이션 | 1 |
| 빌드 | 성공 |

---

## Phase 7-C 완료 선언

- ✅ **G-116**: 응원 메시지 변경 시 `/campaigns/[slug]` ISR 즉시 무효화 (POST/DELETE/PATCH 3경로)
- ✅ **G-102**: `referral_codes` donor 본인 SELECT RLS 정책
- 🟡 **G-101**: 보상 체계 기획과 함께 Phase 8+로 이월

### 다음 후보

- **Phase 7-B — 공유 깊이**: G-118(카톡 OG 미리보기) / G-119(임팩트 이미지 저장 버튼)
- **Phase 8 — 보상 체계**: G-101(초대 보상 악용 방지) / `referral_bonus_grants` 이벤트 테이블 설계
