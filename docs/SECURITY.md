# Security

## 인증
- Donor: Supabase Auth (이메일/비밀번호) 또는 OTP (휴대폰)
- Admin: Supabase Auth 이메일/비밀번호 + `user_metadata.role='admin'`
- Admin 세부 권한: `admin_roles` (super / campaign_manager / finance / support)
- 비밀번호 정책: 8자 이상 + 4종 중 2종 (숫자/기호/대문자/소문자), 흔한 비밀번호 차단
- 세션: Donor OTP JWT 30분 비활성 타임아웃 + 슬라이딩 갱신

## 전송/HTTP
- HSTS preload + includeSubDomains
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: geolocation/camera/microphone 차단
- CSP: 현재 `Content-Security-Policy-Report-Only`. Toss/Supabase 허용. nonce 전환 예정 (G-D166 후속).

## CSRF
- `lib/security/csrf.ts` — Origin/Referer 검증
- 모든 donor/admin mutation 라우트에 `checkCsrf` 적용

## Rate limit
- `lib/security/endpoint-limits.ts` — default (60/min), sensitive (10/10분), low-noise (60/min)
- Redis (Upstash) 폴백 지원 — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## PII
- RRN 암호화 (bytea). 만료 cron `purge-expired-rrn`
- 암호화 키 버전닝 (G-D133): `v{n}:{pgp_sym_encrypt_output}`
- 회전 절차: `ORG_SECRETS_KEY_V{n}` 추가 → `ORG_SECRETS_ACTIVE_VERSION` 증가 → 배치 재암호화 → 구 키 폐기
- 익명화 dump: `/api/admin/export/anonymized` (finance/super)

## Webhook
- Toss: HMAC-SHA256 검증 + IP allowlist (CIDR)
- Resend: svix 서명 검증
- 수신 이벤트 기록: `webhook_events` (processed_at NULL → cron 재시도)

## 감사 로그
- `audit_logs`: admin/system 액션 (결제·환불·회원·영수증·admin 로그인 등)
- `member_audit_log`: donor 본인 계정 변경 (profile/password/2FA/delete)
- 조회 UI: `/admin/audit-logs`, `/admin/members/[id]/audit`

## 보안 이벤트 보고
- `lib/security/siem.ts` — `reportSecurityEvent('auth.admin_login_failed', { ip, email })`
- `OBSERVABILITY_WEBHOOK` 설정 시 Slack/Datadog 으로 push

## 침해 대응
1. 의심 세션 강제 로그아웃: `supabase.auth.admin.updateUserById(user_id, { ... })`
2. 결제 위험 회원: `members.chargeback_risk=true` (신규 후원 검토)
3. 키 탈취: `ORG_SECRETS_ACTIVE_VERSION` 증가 + 재암호화
4. DB 침해: Supabase 대시보드에서 즉시 service_role 재발급

## 컴플라이언스
- `/admin/compliance` 체크리스트
- 개인정보처리방침·이용약관: `/privacy`, `/terms` (orgs 컬럼 오버라이드)
- 데이터 내보내기 (donor 본인): `/api/donor/account/export`
- 회원 soft-delete + PII 마스킹: `/api/donor/account` DELETE
