# SP-5: 보안·세션 강화 (2026-04-24)

## 목적

Supabase Auth MFA 연동, 로그인 알림, 민감 작업 재인증, OTP 접근성 개선. 현재 audit log에 이벤트 타입만 정의되고 실제 구현이 없는 보안 GAP 해소.

---

## 현황 GAP

| GAP | 내용 | 위치 |
|-----|------|------|
| G13 | TOTP/MFA 실제 컬럼·UI·API 없음 | `members` 테이블, audit log에 타입만 정의 |
| G14 | OTP form input에 `<label>` 태그 미연결 | `otp-login-form.tsx:100-106,123-132` |
| G15 | OTP JWT 서버 side 무효화 불가 (stateless) | `src/lib/auth.ts`, `session/bump` |
| G16 | Supabase Auth MFA API 전혀 미호출 | `supabase.auth.mfa.*` 없음 |

---

## 설계 결정

### E16: 2FA/TOTP 활성화 (Supabase Auth MFA 연동)

**채택: Supabase Auth 내장 MFA** (`supabase.auth.mfa.*`)

이유:
- Supabase Auth에 TOTP MFA가 내장 (`supabase.auth.mfa.enroll`, `mfa.challenge`, `mfa.verify`)
- 별도 `totp_secret` 컬럼 불필요 — Auth 레이어에서 관리
- `authMethod === 'supabase'`인 사용자에게만 적용 (`otp` 세션 사용자는 별도 처리 불가)

**플로우**:
```
설정 페이지 → "2단계 인증 활성화" 토글
  → supabase.auth.mfa.enroll({ factorType: 'totp' })
  → QR 코드 표시 (Google Authenticator 등 등록)
  → 6자리 코드 입력 → supabase.auth.mfa.challenge() + verify()
  → 등록 완료 → 이후 로그인 시 TOTP 코드 추가 입력
```

**API**: `/api/donor/account/mfa/` (신규)
- `POST /enroll` — MFA 등록 시작 (QR URI 반환)
- `POST /verify` — 코드 검증 + 등록 완료
- `DELETE /unenroll` — MFA 해제 (재인증 필요)

**UI**: `/donor/settings` 보안 섹션에 추가
```
🔐 2단계 인증
  상태: 미설정 / 설정됨
  [활성화 하기] / [해제]
```

`members` 테이블에 `mfa_enabled boolean` 컬럼 추가 — UI 상태 표시용 캐시 (실제 MFA 상태는 Supabase Auth가 관리).

### E17: 새 기기 로그인 알림 이메일

**탐지 기준**: `member_audit_log`에 `ip_hash` 컬럼 추가. 기존 로그인 이력에 없는 IP hash가 감지되면 "새 기기/IP 로그인" 이메일 발송.

```typescript
// src/lib/auth/new-device-alert.ts (신규)
export async function checkAndAlertNewDevice(
  memberId: string,
  ipHash: string,
  userAgent: string
) {
  const { count } = await supabase
    .from('member_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('ip_hash', ipHash)
    .eq('action', 'login')

  if (count === 0) {
    // 처음 보는 IP — 알림 이메일 발송
    await sendNewDeviceEmail(memberId, { ipHash, userAgent, timestamp: new Date() })
    await logAuditEvent(memberId, 'new_device_login', { ipHash, userAgent })
  }
}
```

**이메일**: Resend/Nodemailer 기존 구현 재활용. 템플릿: "새 기기에서 로그인이 감지되었습니다. 본인이 아니라면 즉시 비밀번호를 변경하세요."

**스팸 방지**: IP hash 기반이므로 동일 IP 재로그인 시 발송 없음. VPN 전환 등으로 오탐 가능성 있으나 허용 (보안 > 편의).

### E18: 민감 작업 재인증

**대상 작업**: 약정 해지, 금액 변경, 영수증 다운로드(최초 1회), 계정 삭제.

**구현 방식**: `X-Reauth-Token` 헤더 기반 — 재인증 통과 시 서버가 30분 유효 토큰 발급, 민감 API 호출 시 이 토큰 요구.

```typescript
// src/lib/auth/reauth.ts (신규)
export function issueReauthToken(memberId: string): string {
  // HMAC-SHA256(memberId + timestamp, REAUTH_SECRET) 단순 토큰
  // 30분 TTL
}

export function verifyReauthToken(token: string, memberId: string): boolean {
  // 토큰 검증 + 만료 확인
}
```

**UI 플로우**:
```
해지 버튼 클릭
  → ReauthModal 표시 ("비밀번호를 다시 입력하세요")
  → POST /api/donor/account/reauth → 토큰 발급
  → 해지 API 호출 (X-Reauth-Token 헤더 포함)
```

`authMethod === 'otp'` 사용자는 OTP 재발송으로 대체.

### E15: 세션·기기 관리

**현황**: Supabase Auth 세션은 클라이언트가 관리, OTP 세션은 서버 쿠키. 기기 목록 페이지는 미존재.

**구현 방향**: Supabase Auth의 `supabase.auth.admin.listUserSessions(userId)` API 활용.
- OTP 세션은 stateless JWT이므로 기기 목록 표시 불가 → Supabase Auth 사용자에게만 노출.

```typescript
// /api/donor/account/sessions/route.ts (신규)
// GET — 활성 세션 목록 (Supabase Auth)
// DELETE /[sessionId] — 특정 세션 revoke
```

**UI**: `/donor/settings` 보안 섹션에 추가
```
📱 활성 로그인 세션
  ├─ 현재 세션 (Chrome · 서울 · 지금)
  └─ iPhone · 인천 · 2일 전   [로그아웃]
```

`authMethod === 'supabase'`만 표시. `authMethod === 'otp'`는 "OTP 로그인은 단기 세션으로 자동 만료됩니다" 안내.

### G14: OTP form 접근성 개선

```tsx
// src/components/donor/otp-login-form.tsx 수정
// 기존: <input placeholder="전화번호" />
// 변경:
<label htmlFor="donor-phone" className="sr-only">전화번호</label>
<input id="donor-phone" aria-label="전화번호" placeholder="010-0000-0000" ... />

<label htmlFor="donor-otp" className="sr-only">인증번호 6자리</label>
<input id="donor-otp" aria-label="인증번호 6자리" aria-describedby="otp-hint" ... />
<span id="otp-hint" className="sr-only">6자리 숫자를 입력하세요</span>
```

### G15: OTP JWT 서버 side 무효화

**현황**: OTP JWT는 stateless — 서버에서 무효화 불가. `session/bump`는 갱신 전용.

**해결**: `otp_session_blocklist` 테이블 도입.

```sql
-- supabase/migrations/20260424XXXXXX_otp_session_blocklist.sql
CREATE TABLE otp_session_blocklist (
  jti text PRIMARY KEY,        -- JWT ID (iat+member_id hash)
  revoked_at timestamptz NOT NULL DEFAULT NOW(),
  reason text
);
-- TTL 자동 정리: pg_cron으로 7일 이상 항목 삭제
```

`getDonorSession()`에서 OTP JWT 검증 시 blocklist 조회 추가. 로그아웃 시 `jti`를 blocklist에 삽입.

성능: blocklist 조회는 인덱스 PRIMARY KEY 조회 → O(1).

---

## 데이터 계층

### 마이그레이션

1. `20260424XXXXXX_member_mfa.sql` — `members.mfa_enabled boolean DEFAULT false`
2. `20260424XXXXXX_member_audit_ip_hash.sql` — `member_audit_log.ip_hash text`
3. `20260424XXXXXX_otp_session_blocklist.sql` — OTP 세션 무효화 테이블

### 패키지

추가 없음 (Supabase Auth MFA는 `@supabase/supabase-js` 내장).

---

## 컴포넌트 계층

### 신규

- `src/lib/auth/new-device-alert.ts` — 새 기기 탐지 + 이메일
- `src/lib/auth/reauth.ts` — 재인증 토큰 발급/검증
- `src/components/donor/settings/ReauthModal.tsx` — 재인증 다이얼로그
- `src/components/donor/settings/MfaCard.tsx` — 2FA 설정 UI
- `src/components/donor/settings/SessionsCard.tsx` — 활성 세션 목록
- `src/app/api/donor/account/mfa/route.ts` — MFA enroll/verify/unenroll
- `src/app/api/donor/account/sessions/route.ts` — 세션 목록/revoke
- `src/app/api/donor/account/reauth/route.ts` — 재인증 토큰 발급

### 수정

- `src/components/donor/otp-login-form.tsx` — G14 label 추가
- `src/lib/auth.ts` — G15 blocklist 조회 추가, 새 기기 탐지 훅
- `src/app/(donor)/donor/settings/page.tsx` — MfaCard, SessionsCard 추가
- `src/app/(donor)/donor/promises/page.tsx` — 해지/금액 변경 시 ReauthModal 연동

---

## 완료 기준

| 항목 | 기준 |
|------|------|
| MFA 등록 | TOTP QR 생성 → 코드 검증 → 설정 완료 E2E |
| MFA 로그인 | 2FA 활성화 사용자 로그인 시 TOTP 코드 요구 |
| 새 기기 알림 | 신규 IP 로그인 시 이메일 수신 |
| 재인증 | 해지 버튼 → ReauthModal → 30분 토큰 → API 통과 |
| OTP 접근성 | 스크린리더 입력 필드 인식 |
| 세션 revoke | 다른 세션 로그아웃 후 해당 세션 API 401 |
| OTP blocklist | 로그아웃 후 기존 JWT 재사용 불가 |

---

## 제외 (YAGNI)

- SMS/이메일 OTP를 2FA 수단으로 추가 (TOTP만 1차)
- 생체 인증 (WebAuthn/Passkey)
- 기기 신뢰 기간 설정 ("30일간 이 기기 신뢰")
- i18n 적용 (SP-6)

---

## 선행 조건

`authMethod` 통일 여부 확인 — `supabase` vs `otp` 분기가 이미 `auth.ts`에 있으므로 SP-5는 독립 진행 가능.
