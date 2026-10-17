# 멀티테넌트 아키텍처 — 현황 진단과 목표 설계

> 작성 2026-10-16. 후원 단체(기관)마다 후원자·후원금이 완전히 분리돼야 하는 SaaS 기준.
> 근거는 모두 이 저장소의 실제 코드/마이그레이션(파일:줄)과 로컬 재현 결과다.

## 1. 시장의 세 가지 격리 방식

| | ① DB 분리 (Database-per-tenant) | ② 스키마 분리 (Schema-per-tenant) | ③ 공유 테이블 + Tenant ID (+ RLS) |
|---|---|---|---|
| 격리 강도 | 가장 강함 (물리 분리) | 강함 (search_path 분리) | 정책에 의존 — **RLS가 강제할 때만** 강함 |
| 운영 비용 | 기관 수만큼 DB·백업·마이그레이션 | 기관 수만큼 스키마 마이그레이션 | DB 하나 |
| 기관 간 통계·플랫폼 운영 | 어려움 (DB 횡단 집계) | 보통 | 쉬움 |
| 기관 추가 속도 | 느림 (프로비저닝) | 보통 | 즉시 (행 하나) |
| 기관별 커스텀·데이터 반출 | 쉬움 | 쉬움 | 보통 (org_id로 덤프) |
| 대표 사례 | 규제 산업 B2B, 대형 고객 전용 인스턴스 | Citus 스키마 샤딩, 일부 Rails Apartment | Salesforce(org_id), Slack, Supabase 기반 SaaS 대부분 |
| 이 프로젝트 적합도 | △ 대형 기관 전용 플랜에만 | ✕ Supabase에서 이점 적음 | **◎ 현재 구조, 유지 권장** |

**권장: ③ 유지 + "RLS가 실제로 강제되는 경로"를 늘리고, 서비스 롤 경로에는 테넌트 필터를 코드로 강제.**
대형 기관이 물리 분리를 요구하면 ①을 별도 플랜(전용 Supabase 프로젝트)으로 추가하는 하이브리드가 현실적이다.

### 구현 예시

```sql
-- ③ 공유 테이블 + RLS — 모든 테넌트 데이터 테이블의 기본형
create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ...
);
create index on members (org_id);
alter table members enable row level security;
create policy members_admin_all on members for all
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));
```

```ts
// ② 스키마 분리 (참고) — 연결마다 search_path 전환
await sql`set search_path to ${sql(`tenant_${slug}`)}, public`

// ① DB 분리 (참고) — 테넌트 → 연결 문자열 라우팅
const db = createClient(tenantRegistry[tenantId].url, tenantRegistry[tenantId].serviceKey)
```

## 2. 현재 구조 진단

요청 흐름: `서브도메인 → proxy.ts(resolveTenant) → x-tenant-id 헤더 → getTenant() → 쿼리에 .eq('org_id', tenant.id)`

| 항목 | 상태 | 근거 |
|---|---|---|
| 테이블 설계 | ✅ 87개 테이블 RLS 활성, 핵심 테이블 `is_org_admin(org_id)` 정책 | `supabase/migrations/20260415000007_rls_policies.sql` |
| **실제 쿼리 경로** | ⚠️ **356개 파일이 서비스 롤(RLS 우회)**, RLS 클라이언트는 13개 | `grep createSupabaseAdminClient` |
| → 결과 | 격리가 "모든 쿼리가 `.eq('org_id')`를 잊지 않는 것"에 달려 있음 | |
| 테넌트 헤더 위조 | 🚨→✅ **수정함.** 테넌트 없는 호스트에서 클라이언트가 보낸 `x-tenant-id`가 그대로 신뢰됨 (로컬 재현) | `src/proxy.ts` |
| 관리자-기관 소속 확인 | 🚨→✅ **수정함.** `requireAdminApi`가 역할만 보고 소속 기관 비교 안 함 | `src/lib/auth/api-guard.ts` |
| **권한 저장 위치** | 🚨→✅ **수정함(마이그레이션 적용 필요).** `user_metadata`(사용자가 직접 수정 가능)의 role/org_id를 신뢰 → 후원자 계정이 임의 기관 관리자로 승격 가능 | `is_org_admin()`, 각 가드 |

## 3. 목표 데이터 모델

```
orgs ─┬─< org_memberships >── auth.users        (관리자·직원: 역할은 여기서, 여러 기관 소속 가능)
      ├─< members (후원자)  ── auth.users?      (supabase_uid 선택적 연결)
      │     ├─< promises (약정) ─< payments
      │     └─< receipts
      ├─< campaigns ─< payments
      └─< tenant_daily_stats (대시보드 집계, org_id + date PK)
```

- **org_memberships**(신규 권장): `(org_id, user_id, role: owner|admin|finance|viewer)`.
  지금은 `app_metadata.org_id`가 하나라 한 사람이 여러 기관을 관리할 수 없다(대행사·지부 운영 불가).
  RLS 판정은 `exists(select 1 from org_memberships where user_id = auth.uid() and org_id = target)`.
- **모든 테넌트 테이블 규칙**: `org_id not null` + `(org_id, …)` 복합 인덱스 + RLS + 자식 테이블도 org_id를 **중복 보유**
  (조인 없이 정책 판정 · 실수로 다른 기관 부모를 참조하는 것을 FK로 막기 위해 `(org_id, id)` 복합 FK 권장).
- **집계 테이블**: 대시보드는 원장(payments)을 매번 스캔하지 않고 `tenant_daily_stats`를 읽는다.

```sql
-- 자식이 다른 기관의 부모를 가리키지 못하게 하는 복합 FK
alter table members add constraint members_org_id_id_key unique (org_id, id);
alter table promises add constraint promises_member_same_org
  foreign key (org_id, member_id) references members (org_id, id);
```

## 4. 서비스 롤 경로의 테넌트 강제 (코드)

356개 파일을 RLS 클라이언트로 한 번에 바꾸는 건 비현실적이다. 대신 **테넌트가 묶인 클라이언트**를 표준으로 삼고 새 코드부터 적용한다.

```ts
// src/lib/tenant/db.ts (제안)
export function tenantDb(tenantId: string) {
  const sb = createSupabaseAdminClient()
  return {
    from(table: TenantTable) {
      return {
        select: (cols: string) => sb.from(table).select(cols).eq('org_id', tenantId),
        insert: (rows: object | object[]) =>
          sb.from(table).insert([rows].flat().map((r) => ({ ...r, org_id: tenantId }))),
        update: (patch: object) => sb.from(table).update(patch).eq('org_id', tenantId),
        delete: () => sb.from(table).delete().eq('org_id', tenantId),
      }
    },
  }
}
```

- `org_id`를 호출부가 넘기지 못하게 해 **빠뜨림·위조 둘 다 불가능**하게 한다.
- ESLint 규칙으로 `src/app/api/admin/**`에서 `createSupabaseAdminClient` 직접 사용을 경고 → 점진 이전.

## 5. API 아웃라인 — 기관별 후원자 등록 · 대시보드 파이프라인

모든 관리자 API는 `requireAdminApi()` → `{ user, tenant }` (역할·소속 검증 완료) → `tenantDb(tenant.id)`.

### 후원자 등록
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/members` | 단건 등록. zod 검증 → `(org_id, phone_hash)` / `(org_id, email)` 중복 검사 → insert. 주민번호는 `encryptSecret()` 후 저장, 평문 로그 금지 |
| POST | `/api/admin/members/import` | CSV 일괄. 업로드 → 행별 검증 결과 미리보기 → 확정 시 트랜잭션 insert. `import_jobs(org_id, status, error_rows)` |
| POST | `/api/donations/prepare` (공개) | 후원 폼 → 후원자 upsert + 약정 생성. 테넌트는 **도메인으로만** 결정(바디의 org_id 무시) |
| GET | `/api/admin/members?q&cursor` | 커서 페이지네이션, 마스킹된 연락처 |

### 대시보드 파이프라인
```
payments INSERT/UPDATE ─▶ 트리거: tenant_daily_stats(org_id, date) upsert (금액·건수·신규후원자)
                         └▶ 매일 03:00 cron: 전일 재집계(정합성 보정)
GET /api/admin/dashboard?from&to ─▶ tenant_daily_stats where org_id = tenant (인덱스 범위 스캔)
```
- 트리거 함수는 `security definer`로 집계 테이블에만 쓰고, 읽기는 RLS로 `is_org_admin(org_id)`.
- 캐시 키에 반드시 `org_id` 포함 (`unstable_cache(fn, ['dashboard', tenant.id, range])`) — 캐시를 통한 기관 간 누출 방지.

## 6. 체크리스트 (새 기능마다)
- [ ] 테이블: `org_id not null`, 인덱스, RLS 정책, 자식은 복합 FK
- [ ] API: `requireAdminApi()` / 공개 API는 도메인 테넌트만 신뢰
- [ ] 쿼리: `tenantDb()` 또는 RLS 클라이언트 — 서비스 롤 직접 사용 시 리뷰 필수
- [ ] 캐시·파일 경로·큐 메시지에 `org_id` 포함 (`<orgId>/…` 저장소 경로처럼)
- [ ] 테스트: 다른 기관 ID로 접근 시 403/빈 결과인지 확인하는 교차-테넌트 테스트

## 마이그레이션 적용 기록 (2026-10-17)
- 원격 DB 이력이 크게 어긋나 있었다: 4월 이후 로컬 마이그레이션 83개 중 28개는 다른 버전명으로 이미 반영, 55개는 미적용.
- 미적용 원인: 6개 파일이 **존재하지 않는 `admin_users` 테이블**을 참조 → 적용 불가였다. `is_org_admin()` / `auth.users`로 교체.
  (nts_export_logs, email_templates, email_notifications_log, referral_program, inquiries_board, org_units — `can_admin_access_unit`은 단위별 관리자 범위가 앱에 없어 기관 관리자 여부만 본다)
- 절차: 객체 존재 여부로 분류 → 미적용분 전체를 `BEGIN … ROLLBACK`으로 실제 스키마에 시험 실행(통과) → 반영된 28개 `repair --status applied`, 로컬 파일 없는 원격 이력 17개 `repair --status reverted`(스키마 변경 없음) → `db push --include-all`.
- 결과: 로컬·원격 이력 111/111 일치. 000002 백필로 관리자 90명이 app_metadata로 이전. 제외된 66명은 모두 `@example.test` 통합 테스트 잔여 계정(후원자 레코드 연결).

## 번호 발급(M-/P-/PMT-) — 20261017000001
- 예전: 라우트마다 "개수 + 1" / "최근 행 번호 + 1" / 난수. 동시 요청·회원 삭제·다른 형식 번호가 섞이면 같은 번호 → 유니크 위반 → 첫 후원 결제·가입 실패(개발 DB에서 후원자 로그인 `member_create_failed`로 재현).
- 지금: `code_counters`(기관·종류·연도) + `next_code_seq()` 한 문장 증가. 앱은 `src/lib/codes-seq.ts`의 `nextCode` / `reserveCodes`(대량 가져오기는 한 번에 예약)만 쓴다.
- 미적용: `src/lib/donations/service.ts`(작성 중인 미추적 파일)는 아직 난수 번호 — 난수 0이면 예외, 기존 회원 upsert 시 회원번호를 덮어씀.
