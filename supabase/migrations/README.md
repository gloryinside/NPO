# Migration Guide

## 파일명 규칙
`YYYYMMDDHHMMSS_snake_case_description.sql`

CI의 `migration-check` job이 이 형식을 검증한다.

## Idempotency
모든 DDL은 재실행해도 실패하지 않도록 작성한다:

- `create table if not exists …`
- `create index if not exists …`
- `alter table … add column if not exists …`
- `drop policy if exists …; create policy …`

## Rollback 주석 (G-D68)
각 마이그레이션 파일 상단에 rollback 방법을 주석으로 명시한다. 예:

```sql
-- rollback: drop table member_audit_log;
```

복잡한 변경의 경우:

```sql
-- rollback:
--   alter table members drop column referrer_id;
--   drop index if exists idx_members_referrer;
```

## 적용 흐름

1. 로컬 개발: `supabase db reset`(초기화) 또는 MCP `apply_migration` 사용
2. 원격 적용: `supabase db push` (CI가 PR 머지 시 자동 실행 — TODO)
3. 적용 상태 확인:
   ```sql
   select version from supabase_migrations.schema_migrations order by version;
   ```

## 적용 누락 복구 (G-D96)
원격에 적용되지 않은 마이그레이션이 발견되면:

1. 누락 테이블/컬럼 목록 작성
2. `if not exists` 기반 idempotent SQL 로 복구 마이그레이션 작성
   (예: `20260423000009_recover_missing_tables.sql`)
3. 복구 적용 → 원격의 `schema_migrations` 행도 함께 insert 됨

## 새 테이블 체크리스트

- [ ] `create table if not exists`
- [ ] Primary key 지정
- [ ] `org_id` FK (multi-tenant 격리)
- [ ] `created_at`, `updated_at`(필요 시) timestamp
- [ ] 주요 조회 패턴에 맞는 인덱스
- [ ] `enable row level security`
- [ ] RLS 정책 최소 1개 (본인 접근 또는 admin bypass)
- [ ] `comment on table …` 로 목적 기재
- [ ] Rollback 주석
