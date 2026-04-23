# Operations Checklist

## 일일 체크
- [ ] `/api/health` 200 OK (DB·환경변수)
- [ ] `/api/health/readyz` ready
- [ ] 전일 cron 로그: `cron.process-payments.complete`, `retry-billing.complete` 등
- [ ] Admin 알림 — failed payment / chargeback / email bounce 집중 여부

## 주간 체크
- [ ] `/admin/reports/data-health` 에서 카드키 누락 정기후원, 중복 회원, email_disabled 비율
- [ ] CI 실패율 (GitHub Actions)
- [ ] Vercel 사용량 (함수 실행·대역폭)
- [ ] `/admin/notifications` 미확인 알림

## 월간 체크
- [ ] `/api/admin/reports/monthly?year=&month=` CSV 대조
- [ ] `/api/cron/monthly-financial-report` 발송 확인 (finance/super 수신)
- [ ] `/api/cron/purge-orphan-storage` 결과 검토 (DRY-RUN → 필요 시 `execute=1`)
- [ ] 익명화 dump 외부 공유 여부 — `/api/admin/export/anonymized`

## 분기별
- [ ] PII 암호화 키 회전 검토 (`ORG_SECRETS_ACTIVE_VERSION` ++)
- [ ] Admin RBAC 역할 점검 — 불필요한 super 축소
- [ ] Dependabot PR 묶음 처리
- [ ] 백업 복구 리허설

## 연 1회
- [ ] 개인정보처리방침·이용약관 업데이트 (orgs.*_markdown)
- [ ] 영수증 일괄 발급 cron (`issue-annual-receipts`) 성공 여부
- [ ] 연말정산 요약 다운로드 안내 (후원자)

## cron 스케줄 한 장 보기
| Cron | 스케줄 (UTC) | 목적 |
|---|---|---|
| process-payments | 00:00 | 정기결제 집행 |
| billing-reminder | 00:30 | D-3 결제 예정 안내 |
| retry-billing | 01:00 | 실패 결제 재시도 |
| lifecycle-emails | 01:00 | welcome/anniversary/dormant |
| reactivation-offer | 01:30 | 해지 후 30/60/90일 |
| suggest-amount-increase | 01:45 월요일 | 연 단위 금액 인상 제안 |
| purge-expired-rrn | 02:00 | RRN 암호문 만료 정리 |
| auto-close-campaigns | 02:30 | 종료일 지난 campaign 종료 |
| cancel-stale-payments | 03:00 | 24h 넘긴 unpaid 취소 |
| notify-churn-risk | 04:00 월 | 이탈 위험 회원 알림 |
| purge-orphan-storage | 04:00 매월1일 | 고아 storage 정리 |
| retry-failed-emails | 4h 주기 | 메일 재전송 |
| birthday-greeting | 15:15 | 생일 감사 |
| classify-lifecycle | 21:00 | lifecycle_stage 분류 |
| auto-publish-campaigns | 21:05 | scheduled publish |
| monthly-financial-report | 23:00 매월3일 | 재무 요약 이메일 |
| issue-annual-receipts | 00:00 매년 1/5 | 연말 영수증 |

## 장애 대응
- DB 장애 → `/api/health` 503. Supabase status 확인
- 대량 webhook 누락 → `webhook_events` pending 수 집계, `/admin/audit-logs` 참조
- 결제 이중 처리 → UNIQUE `(org_id, toss_payment_key)` 로 DB 차단. 발생 시 insert 23505 로 확인
