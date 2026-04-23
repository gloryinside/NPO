# Deployment

## 환경
- **Production**: Vercel (main 브랜치 자동 배포)
- **Preview**: PR 자동 배포
- **Local**: `pnpm dev` + Supabase local 또는 원격 `NEXT_PUBLIC_SUPABASE_URL`

## 배포 순서
1. PR → CI 통과(`.github/workflows/ci.yml`): tsc + lint + vitest + migration 파일명
2. `main` 머지 → Vercel 자동 배포
3. Preview → Promote to Production 또는 `vercel --prod`

## 필수 환경변수 (Production)
| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | service role |
| `OTP_JWT_SECRET` | 32자 이상 |
| `CRON_SECRET` | Vercel Cron 인증 |
| `TOSS_WEBHOOK_SECRET` | Toss webhook HMAC |
| `TOSS_WEBHOOK_ALLOWED_IPS` | 쉼표 구분 CIDR (선택) |
| `RESEND_API_KEY` / `SMTP_*` | 이메일 발송 |
| `ORG_SECRETS_KEY_V1` | PII 암호화 키 (v1 레거시) |
| `ORG_SECRETS_ACTIVE_VERSION` | 활성 키 버전 번호 |
| `NEXT_PUBLIC_BASE_DOMAIN` | robots.ts 가 프로덕션 여부 판정 |

## DB 마이그레이션
```bash
# 로컬
supabase db push

# 수동 확인
select version from supabase_migrations.schema_migrations order by version desc limit 10;
```

자세한 순서·idempotency 규칙은 [../supabase/migrations/README.md](../supabase/migrations/README.md) 참고.

## 롤백
1. Vercel Deployments → 직전 성공 빌드 → **Promote to Production**
2. DB 롤백은 각 마이그레이션 상단의 `-- rollback:` 주석 참고
3. Cron 즉시 중단: `vercel.json` schedule 을 `* * 31 2 *` 같은 절대 미발생 값으로 변경 후 재배포

## Graceful shutdown (G-D187)
배포 직전 이전 instance 에 `SHUTTING_DOWN=1` 환경변수 설정 → `/api/health/readyz` 가 503 반환 → LB 가 신규 요청 차단.
