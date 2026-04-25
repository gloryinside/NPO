-- 조직 단위(지부/본부) 세분화
--   하나의 org 안에 여러 unit (본부/서울지부/부산지부 등).
--   members.unit_id, payments.unit_id로 데이터 분리.
--   admin_user에 unit_id를 부여하면 그 unit의 데이터만 접근 가능.
--   unit_id NULL = 본부 전체 (super admin)

create table if not exists org_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  parent_id uuid references org_units(id) on delete set null,
  code text not null,                  -- 'HQ', 'SEOUL', 'BUSAN' 등
  name text not null,                  -- '본부', '서울지부', '부산지부'
  manager_email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists idx_org_units_org on org_units (org_id, active);
create index if not exists idx_org_units_parent on org_units (parent_id) where parent_id is not null;

-- members/payments에 unit_id 추가 (NULL = 본부)
alter table members add column if not exists unit_id uuid references org_units(id) on delete set null;
alter table payments add column if not exists unit_id uuid references org_units(id) on delete set null;
alter table promises add column if not exists unit_id uuid references org_units(id) on delete set null;

create index if not exists idx_members_unit on members (org_id, unit_id);
create index if not exists idx_payments_unit on payments (org_id, unit_id);
create index if not exists idx_promises_unit on promises (org_id, unit_id);

-- admin_users 에 unit_id (있는 컬럼인지 확인 — 없을 수도 있어 조건부)
alter table admin_users add column if not exists unit_id uuid references org_units(id) on delete set null;
alter table admin_users add column if not exists unit_scope text default 'org'
  check (unit_scope in ('org','unit','sub_units'));
--   org: 전체 org 접근 (기본)
--   unit: 자신의 unit_id 데이터만
--   sub_units: 자신의 unit + 모든 하위 unit 데이터

create index if not exists idx_admin_users_unit on admin_users (org_id, unit_id);

alter table org_units enable row level security;
drop policy if exists "org_units_admin_all" on org_units;
create policy "org_units_admin_all" on org_units
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- 헬퍼 함수: 현재 admin이 특정 unit_id 데이터를 볼 수 있는가
create or replace function can_admin_access_unit(target_org uuid, target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users au
    where au.supabase_uid = auth.uid()
      and au.org_id = target_org
      and (
        au.unit_scope = 'org'                                -- 전체 접근
        or (au.unit_scope = 'unit' and au.unit_id = target_unit)  -- 자기 unit만
        or (au.unit_scope = 'sub_units' and (
          au.unit_id = target_unit
          or target_unit in (
            with recursive sub as (
              select id from org_units where id = au.unit_id
              union all
              select c.id from org_units c join sub on c.parent_id = sub.id
            )
            select id from sub
          )
        ))
      )
  );
$$;

comment on table org_units is
  '조직 단위(지부/본부). 계층 구조 지원 (parent_id). admin이 unit_id로 데이터 격리.';
comment on function can_admin_access_unit is
  'admin이 특정 unit 데이터를 볼 수 있는지 평가. unit_scope에 따라 org/unit/sub_units 분기.';
