# Ops Runbook

## 1. Health check (G-D66)
- `GET /api/health` — 200 OK (DB + 필수 env 점검)
- `503` 응답 시: `checks` 필드의 `ok:false` 항목으로 원인 파악
- Uptime monitoring: 60s 간격 권장, `status` 또는 HTTP 5xx로 알림

## 2. Cron (G-D69)
- `vercel.json` 에 정의된 10개 cron 작업
- 각 cron은 `runCron(req, name, handler)` 래퍼 사용 — 시작/종료/실패 이벤트가 `reportEvent`/`reportError` 로 흘러감
- 실제 알림은 `OBSERVABILITY_WEBHOOK` 환경변수 설정 시 Slack 등으로 전달
- 실패 시 재시도: Vercel Cron은 자동 재시도 없음 → `retry-billing` 등 핵심 cron은 **매일 실행해야 중요 이벤트가 누적되지 않음**

## 3. Error tracking (G-D67)
현재는 경량 어댑터 (`lib/observability/report.ts`). 프로덕션 전환 절차:

1. Sentry 프로젝트 생성 → DSN 획득
2. `npm install @sentry/nextjs` 설치
3. `report.ts` 내부에서 `Sentry.captureException(err, { extra: ctx })` 추가
4. `SENTRY_DSN` env 주입, `next.config.ts` 에 withSentryConfig 래핑

이전 호출부는 수정 불필요 — 추상화 레이어 유지.

## 4. 마이그레이션 동기화 (G-D96)
로컬 `supabase/migrations/*.sql` 파일과 원격(`supabase_migrations.schema_migrations`) 적용 이력이 **불일치**할 수 있음.

점검 쿼리:
```sql
select version from supabase_migrations.schema_migrations order by version;
```

**파일이 원격에 없으면**: 수동 적용(`supabase db push` 또는 MCP tool).
**원격에 있지만 파일이 없으면**: `supabase db pull` 로 스키마 덤프 → 파일 추가.

인덱스된 파일명 규칙: `YYYYMMDDHHMMSS_설명.sql` (타임스탬프 단조 증가).

### 핵심 테이블 존재 검증
```sql
select table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
order by table_name;
```

최소 13개 이상이어야 정상. 누락 시 `20260423000009_recover_missing_tables.sql` 재실행.

## 5. Rate limit (G-D73)
현재 구현은 **인-메모리** (`src/lib/rate-limit.ts`).
- Vercel 다중 인스턴스 환경에서는 인스턴스당 카운트 → 총량 초과 가능
- 운영 확장 시 Vercel KV / Upstash Redis 교체 필요

## 6. Webhook 보안 (G-D72)
- `/api/webhooks/toss` — HMAC 서명 검증
- Toss IP 화이트리스트는 현재 미적용 — 공식 문서 참조 후 운영 환경에서 리버스 프록시 측 제어 권장

## 7. Deploy 롤백
1. Vercel Deployments → 직전 성공 빌드 → **Promote to Production**
2. DB 스키마 롤백: 각 마이그레이션에 주석으로 `-- rollback: DROP ...` 명시 필요 (현재 일부만 작성됨 — G-D68 개선 과제)
3. Resend / Toss billing: cron 일시 중단은 `vercel.json` 의 schedule을 `* * 31 2 *` (절대 매치되지 않는 날짜)로 변경 후 재배포
