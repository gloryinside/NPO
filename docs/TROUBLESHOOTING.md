# Troubleshooting

## 로그인 / 세션

### "세션이 만료되었습니다" 모달이 반복 표시
- OTP JWT 는 30분 비활성이면 자동 만료. `SessionKeepalive` 가 click/key 감지 5분 주기 bump.
- 브라우저 쿠키 차단 여부 확인 (`donor-otp-session` SameSite=Lax, HttpOnly)

### 관리자 로그인 후 `/admin` 접근 401
- `user_metadata.role === 'admin'` 필요. Supabase Auth 대시보드에서 user_metadata 확인.
- tenant 해석 실패 시 400 반환 — x-tenant-id 미주입, middleware 가드 미경유 점검.

### "비밀번호 찾기" 메일이 안 옴
- `/api/donor/password/reset-request` 는 enumeration 방지를 위해 항상 200. 실제 발송 실패는 서버 로그 확인.
- Supabase Auth → Templates → Reset password 템플릿 설정 여부 점검.

## 결제

### 결제는 성공했는데 `pay_status=unpaid` 유지
- Toss webhook 수신 여부 확인 — `webhook_events` 또는 Toss 대시보드 재전송 로그.
- `TOSS_WEBHOOK_SECRET` 불일치 시 401 반환 — 서버 로그 확인.

### 환불을 진행했는데 `refund_amount` 반영 안 됨
- `refund_approvals.status` 가 `approved` 이후에만 실제 Toss 환불 실행 — `executed_at` 확인.
- 요청자와 승인자가 동일하면 승인 라우트가 403 반환.

### 결제 이중 처리 위험
- `(org_id, toss_payment_key)` UNIQUE 인덱스로 DB 차단. INSERT 시 `23505` → 이미 처리됨.

## 영수증

### PDF가 "준비 중" 상태로 고정
- `issue-annual-receipts` cron 실행 시기·로그 확인.
- `receipts.pdf_url` NULL → 스토리지 경로 수동 업로드 필요.
- `/admin/reports/data-health` 에서 "PDF 미발급 영수증" 카운트 확인.

### ZIP 일괄 다운로드 시 413
- 200건 초과 → 연도별 나누어 요청. 클라이언트 UI 가 안내.

## Cron

### cron 이 안 돌았음
- `cron.<name>.complete` 이벤트가 `reportEvent` 로 발송되므로, 미발송이면 Vercel Cron 에러.
- `CRON_SECRET` 미설정 또는 schedule 문자열 오류.

### cron 에서 이메일 발송 실패
- `retry-failed-emails` cron 이 실패 기록 재시도.
- `members.email_disabled=true` 인 경우 건너뜀 (bounce 누적).

## 웹훅

### Resend webhook 서명 실패
- `RESEND_WEBHOOK_SECRET` 미설정 시 서명 스킵 (개발용). 프로덕션 반드시 설정.
- `whsec_` prefix 포함 여부 확인.

### Toss webhook IP 거부
- `TOSS_WEBHOOK_ALLOWED_IPS` 가 설정된 경우만 enforcement.
- CIDR 형식 (`/24` 등) 확인 — IPv6 미지원.

## DB

### 마이그레이션 불일치
- 로컬 파일 vs `supabase_migrations.schema_migrations` 다를 수 있음.
- 복구: `20260423000009_recover_missing_tables.sql` 같은 idempotent 마이그레이션 추가 후 재적용.

### RLS 거부로 쿼리 실패
- service_role 사용 시 우회. client 사용 시 본인 접근 정책 확인.
- `member_audit_log_self_select`: `members.supabase_uid = auth.uid()` 필요.
