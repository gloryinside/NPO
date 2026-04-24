# SP-4/SP-5 연기 항목 — 후속 스펙 입력

**작성일**: 2026-04-24
**상태**: Draft — 다음 브레인스토밍 세션의 입력 자료
**선행 맥락**: `docs/2026-04-24-mypage-enhancement-roadmap.md` 및 SP-1~6 1차 구현(2026-04-24 커밋 `85c9f5f..99bd3f2`).

1차 세션에서 구현 **완료**된 항목은 여기 다시 적지 않는다. 아래는 SP-4, SP-5 원본 설계에서 의도적으로 **범위에서 제외**한 항목과, 각자의 재검토가 필요한 이유다.

---

## A. SP-4 / 세대 합산 영수증 (household)

### 현상

- 원본 설계(`docs/2026-04-24-sp4-tax-receipt-design.md`)에는 `members.household_id` 자기 참조 FK와 `household_invites` 테이블, `/api/donor/account/household` GET/POST/DELETE, 받는이 수락/거절 UI, 영수증 페이지의 세대 합산 섹션이 포함됐다.
- 1차 구현에서는 **전부 연기**. 이유:
  1. 초대 수락/거절 플로우는 "누가 누구에게, 어떤 동의로" 세대를 구성하는지를 사용자 동의 화면에서 명시해야 한다 — 단순 버튼 3개로는 법무/세무 리스크.
  2. 국세청 연말정산 간소화의 "부양가족 영수증 합산" 규정은 **세대주와 부양가족의 관계 증빙**(가족관계증명서 등)을 전제한다. 서비스에서 "초대 수락"만으로 세대를 선언하는 것은 실제 공제 자격과 다를 수 있다. 사용자가 잘못된 기대(자동 합산)를 가지면 피해.
  3. `organizations` FK 오타(원본 SQL에서 `orgs`가 아닌 `organizations`로 작성) — 실제 적용 전에 교정 필요.

### 결정이 필요한 질문

1. **공제 자격 검증 주체**: 사용자가 세대를 "신고"만 하고 공제는 본인이 홈택스에서 직접 처리하는 조회용 기능인가, 아니면 서비스가 "합산 영수증 PDF"를 직접 발급하는가?
2. **초대 수신자 알림 채널**: 이메일? 서비스 내 알림? 전화번호 기반 SMS?
3. **세대주 변경/해체**: 세대 해체 시 과거 영수증은 어떻게 되나. 탈퇴자의 영수증 조회 권한은?
4. **RLS**: 현재 members는 admin-only RLS. 세대원이 다른 세대원 정보(이름·총 후원액)를 조회하는 새 권한을 열려면 별도 정책 필요.
5. **SP-2의 YearSelector와 상호작용**: 세대 합산은 연도별로 다르게 나타나야 한다 (가족 구성 변화).

### 다음 단계

본 항목은 **별도 PRD 세션**이 필요하다. 법무 검토 → UX 와이어프레임 → RLS 정책 → 초대 플로우 → 구현 순서. `docs/superpowers/specs/` 하위 신규 스펙으로 진행.

---

## B. SP-4 / 영수증 PDF에 QR 실시간 삽입

### 현상

- 원본 설계 Task 3은 "다운로드 라우트가 저장소의 PDF를 받아 QR을 오버레이한 새 PDF를 반환"이었다.
- 1차 구현에서 **연기**. 이유:
  1. 영수증 불변성 원칙 — 한 번 발급된 영수증의 바이트는 재발행/취소가 아닌 한 바뀌지 않아야 감사·법무상 안전.
  2. QR은 **발급 파이프라인** (`receipts` row가 처음 만들어지고 PDF가 Storage에 기록되는 지점)에서 포함돼야 하며, 다운로드 시점의 편집은 아키텍처 오염.
  3. `/verify/receipt/[code]` 공개 페이지는 이미 구현돼 있으므로, QR 없이도 "영수증 코드를 수동 입력" 형태로 기능은 작동한다.

### 결정이 필요한 질문

1. **발급 파이프라인 소유자**: 현재 admin 측에서 영수증을 언제 어떻게 발급하는지. cron? admin UI 수동 버튼?
2. **QR 인코딩 내용**: URL만 (`https://domain.tld/verify/receipt/<code>`)인가 서명된 payload인가? 서명을 넣으면 변조 방지가 강해지지만 코드 교체 시 재서명 필요.
3. **기존 발급 영수증**: QR 없는 PDF를 받은 사용자에게 소급 재발급? 아니면 신규 발급만?

### 다음 단계

발급 파이프라인을 먼저 매핑하고(admin 측 라우트/크론 추적), QR 생성을 그 단계에 삽입. 다운로드 라우트는 손대지 않는다.

---

## C. SP-5 / TOTP MFA 풀 플로우

### 현상

- 원본 설계 Task 6은 `MfaCard` UI + `/api/donor/account/mfa` route + `supabase.auth.mfa.*` 호출이었다.
- 1차 구현에서 **`members.mfa_enabled` 캐시 컬럼만 추가**하고 API/UI는 연기. 이유:
  1. Supabase Auth MFA는 **세션 레벨 요구** — 한 번 enroll 후 다음 로그인부터 기본적으로 요구되고, 예외를 서비스 측에서 해제하려면 `assurance_level` 체크를 모든 보호 라우트에 넣어야 한다.
  2. OTP(JWT) 로그인 사용자에게는 동일 MFA를 적용할 경로가 없다 — `authMethod === 'otp'` 분기가 전 API에 필요.
  3. QR 등록 → 백업 코드 → 분실 복구까지 포함해야 "현장에서 사용 가능한" 플로우가 되는데 백업 코드 UI/이메일 발송은 별도 범위.

### 결정이 필요한 질문

1. **MFA 대상**: Supabase Auth 계정만? OTP 사용자는 "2단계 인증 미지원" 배너를 띄울 것인가?
2. **assurance_level 강제 위치**: 로그인 후 모든 donor 경로, 아니면 민감 작업(해지/금액 변경/계정 삭제)에만? 후자라면 **본 세션에서 구현한 `REAUTH_SECRET`과 역할이 겹친다 — 하나로 통합 검토 필요**.
3. **백업 코드**: 10개 1회용 코드를 UI에 노출? PDF? 백업 코드 저장 스키마는?
4. **분실 복구**: 관리자 수동 해제 API? 본인 인증(홈택스? CI?) 후 자가 복구?

### 다음 단계

`REAUTH_SECRET` 토큰(이미 구현)이 MFA의 부분 집합인지 확인. 둘을 통합하면 단순화 가능. 별도 스펙에서 플로우 다이어그램 작성 후 진행.

---

## D. SP-5 / 새 기기 로그인 알림

### 현상

- 원본 설계 Task 5는 `member_audit_log` 테이블에 `ip_hash` 컬럼 추가 + 로그인 시 탐지 훅.
- 1차 구현에서 **연기**. 이유:
  1. `member_audit_log` 테이블이 아직 스키마에 없음 — `audit_logs` (admin 전용)와 명시적으로 분리된 member 레벨 감사 테이블을 새로 설계해야 한다. 컬럼 후보: `action`, `actor_type`, `target_*`, `ip_hash`, `ua`, `meta`.
  2. IP 추출 경로가 현재 `getDonorSession` 체인에는 없음. Next 16 서버 액션/라우트에서 `headers()` 기반으로 IP를 꺼내는 래퍼 필요.
  3. 이메일 알림 자체는 이미 있는 `sendEmail()` 재활용 가능하나, 템플릿/스팸 임계값/opt-out 동의는 별도 설계.

### 결정이 필요한 질문

1. **audit 테이블 분리**: `member_audit_log` 신설 vs `audit_logs` 확장 중 어느 쪽?
2. **IP 해싱 솔트**: `SHA256(ip)` 단순 해시면 레인보우 공격에 취약 — 기관별 or 전역 솔트 필요?
3. **VPN/모바일 IP 전환**: 알림 오탐 허용 수준. 24h 내 재알림 억제 등 debounce 정책.
4. **알림 수신 opt-out**: 보안 알림은 opt-out 금지? 아니면 notification_prefs 테이블에 새 키 추가?

### 다음 단계

audit 테이블 설계를 먼저 문서화하고, SP-5 통합 스펙에 포함.

---

## E. SP-5 / 활성 세션 목록 UI

### 현상

- 원본 설계 Task 7은 `supabase.auth.admin.listUserSessions` + `deleteUserSession` 기반 세션 카드.
- 연기 이유:
  1. 해당 Admin API 시그니처가 `@supabase/supabase-js` 버전에 따라 다름 — 검증 필요.
  2. OTP 사용자에게는 표시할 세션이 **1개**밖에 없고 (JWT 쿠키), 그마저도 blocklist로 관리되므로 UI 설계가 분기됨.
  3. Supabase Auth 세션은 기기 식별자(`user_agent`, `created_at`)를 제공하지만 위치는 주지 않음 — "iPhone · 인천 · 2일 전" 형태를 구현하려면 별도 IP geolocation 의존성 추가.

### 결정이 필요한 질문

1. **Supabase 버전 확인**: 프로젝트 `@supabase/supabase-js` 버전에서 `auth.admin.listUserSessions` 지원 여부.
2. **geolocation**: 단순 "User-Agent · 생성일"만 표시하고 위치는 생략? MaxMind 등 외부 DB 도입?
3. **OTP + Supabase 혼용**: 계정이 두 방식으로 동시에 로그인된 경우 UX.

### 다음 단계

버전 확인 후 Admin API 반환값을 실측하고, 최소 실용 UI(UA + 생성일)로 구현. geolocation은 별도 이터레이션.

---

## F. SP-6 / i18n 전수 치환 (나머지 56개 파일)

### 현상

- 1차에서 `HeroSection` + 대시보드 `page.tsx` 2개 파일만 적용. 58개 donor 파일에 한글 하드코딩이 725줄 남아있다.
- 패턴은 이미 확립됨: async 서버 컴포넌트 → `await getT()`, 문자열 치환.

### 다음 단계

파일 단위 PR 시리즈로 진행. 권장 순서:

| PR | 범위 | 우선순위 |
| --- | ---- | ---- |
| PR-1 | `promises/`, `payments/`, `impact/` 페이지 루트 | 사용자 노출 높음 |
| PR-2 | `receipts/`, `settings/` 페이지 루트 | |
| PR-3 | `components/donor/dashboard/*` | HeroSection 외 잔여 컴포넌트 |
| PR-4 | `components/donor/promises/*`, `payments/*` | 다이얼로그/버튼 라벨 |
| PR-5 | `components/donor/settings/*`, 기타 | |

각 PR은 **키 추가 → 파일 치환 → 빌드/타입체크 → LocaleToggle로 en 전환 수동 확인**을 한 사이클로 돌린다.

---

## G. SP-6 / WCAG 감사 잔여

1차에서 emoji `aria-hidden`, 테이블 caption, OTP form label, reduced-motion 전역은 처리됐으나:
- 색 대비(`design-check` 페이지 활용한 자동 측정) 미수행
- 모달 focus trap은 `CancelConfirmModal`만 완성, 다른 다이얼로그(`AmountChangeDialog`, `UpdateBillingKeyDialog`) 확인 필요
- Lighthouse a11y 점수 기준선 미측정

### 다음 단계

PR-5 또는 별도 "a11y 감사" PR에서 Lighthouse CI 결과 기준으로 잔여 항목 처리.

---

## 연기 항목 공통 원칙

- **각 항목은 독립 가능**: 한 번에 다 할 필요 없다. 사용자 가치가 큰 것부터.
- **법무/세무 의존 항목(A, B)**은 기술 작업 전에 외부 확인 필수.
- **보안 연계 항목(C, D, E)**은 하나의 통합 스펙으로 묶으면 중복 설계 줄일 수 있다 — "MFA + 재인증 + 새 기기 알림 + 세션 관리" 단일 PRD.
- **i18n/a11y 마감(F, G)**은 병렬로 진행 가능. 가장 리스크 낮음.
