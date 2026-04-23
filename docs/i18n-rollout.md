# Donor 포털 i18n 롤아웃 로드맵 (G-D65)

**최종 업데이트**: 2026-04-23
**기반 스택**: `src/lib/i18n/donor.ts` (ko/en, 쿠키 기반 locale, `getT()` 서버 컴포넌트 헬퍼)

---

## 현재 상태 (2026-04-23)

- ✅ locale 쿠키 + POST `/api/donor/locale` (쿠키 TTL 1년)
- ✅ `LocaleToggle` 컴포넌트 (설정 페이지에 탑재)
- ✅ `getT()` 서버 헬퍼 + `MESSAGES` 사전 (10개 키)
- ❌ 실제 페이지 텍스트 99%는 하드코딩된 한국어

## 롤아웃 3단계

### Phase 1 — 공통 chrome (Week 1)
범위: 레이아웃·네비게이션·에러·빈 상태 등 **재사용도 높은 텍스트**.

| 파일 | 대상 텍스트 |
|---|---|
| `DonorNav`, `DonorFAB`, 모바일 네비바 | 홈·약정·납입·영수증·임팩트·응원·설정·새 후원 |
| `layout.tsx` 풋터 | 개인정보처리방침·이용약관·문의하기 |
| `error.tsx`, `not-found.tsx` | 오류 제목·본문·CTA |
| `EmptyState` 호출부 | 각 페이지 빈 상태 (promises/receipts/impact) |
| `OfflineBanner`, `SessionExpiredGuard` | 오프라인·세션 만료 안내 |
| `InlineLoading` | "불러오는 중…" |

스타일: `t("donor.nav.home")` 같은 도메인 계층 키 사용.

### Phase 2 — 모달·폼·버튼 (Week 2)
범위: 사용자 액션 경로의 안내·검증 메시지.

| 파일 | 대상 |
|---|---|
| `CancelConfirmModal` | 제목·본문·확인·취소 |
| `AmountChangeDialog`, `UpdateBillingKeyDialog` | 레이블·에러·프리셋 칩 |
| `ForgotPasswordForm`, `ResetPasswordForm`, `PasswordChangeCard` | 레이블·복잡도 힌트·결과 메시지 |
| `AccountDeleteCard` | 경고 문구·동의 체크박스 |
| `NotificationPrefsForm` | 항목 레이블·설명 |

주의: 정책 메시지(비밀번호 복잡도)는 서버(`checkPasswordStrength`)에서 key 만 반환하고 클라이언트에서 번역하는 구조로 리팩터 필요.

### Phase 3 — 이메일·PDF·SMS (Week 3+)
범위: 사용자가 포털 밖에서 받는 자산.

- Supabase Auth 이메일 템플릿 (Reset Password, Signup, OTP) — 대시보드 설정에서 locale별 버전 관리
- 계정 삭제 확인 이메일 (`/api/donor/account/route.ts`) — HTML 내 텍스트를 `t()`로 치환
- 영수증 PDF 생성 (서버) — locale 파라미터 받아 렌더
- OTP SMS 본문

## 가이드

### 키 네이밍 규칙
- `donor.<area>.<purpose>` 형식
- 예: `donor.login.title`, `donor.settings.security.password_change`, `donor.impact.empty.cta`
- 텍스트 변형(단수/복수)은 키 suffix로: `donor.promises.count_one`, `donor.promises.count_other`

### 커밋 단위
- 한 PR당 한 페이지·컴포넌트 범위로 제한 (review 부담 축소)
- 번역 누락 키는 `MESSAGES[DEFAULT_LOCALE]` 로 폴백되므로 단계적 롤아웃 안전

### 새 기능 작성 규칙
- 2026-05-01 이후 작성되는 신규 donor UI는 반드시 `t()` 경유
- PR 템플릿에 "i18n 키 등록 체크" 체크박스 추가

### 번역 관리
- 현재: `lib/i18n/donor.ts` 하드코딩 사전
- 규모 증가 시(100+ 키) → JSON 파일 분리 (`locales/ko.json`, `locales/en.json`) + 빌드 시 import
- 그 이상(500+ 또는 실 운영) → Crowdin/Tolgee 같은 SaaS 연동

## 확장 대상 언어 (우선순위)

1. **ko** (기본)
2. **en** (해외 동문·영문 NPO 파트너사)
3. **ja** (대상 캠페인 발생 시)
4. **zh-CN** (대상 캠페인 발생 시)

## 리스크

- **PII 포함 문구 번역 실수** — 이름/주소를 직접 interpolate 할 때 문장 구조 차이로 어색해질 수 있음. 플레이스홀더 규약 필요.
- **날짜/통화 포맷** — `Intl.DateTimeFormat(locale)` / `Intl.NumberFormat(locale, { style: 'currency', currency: 'KRW' })` 전면 적용 필요. (현재 `ko-KR` 하드코딩)
- **RTL 레이아웃** — 한/영/일/중은 모두 LTR이라 당분간 불요. 아랍어 확장 시 재검토.

---

## 트래킹

- 전체 키 개수 진행률: `3/약 250` (~1.2%)
- 실제 페이지 텍스트 중 `t()` 사용 비율: 0% (현재 모두 하드코딩)
- 다음 마일스톤: Phase 1 공통 chrome — 예상 80개 키
