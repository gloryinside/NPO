-- Custom Fields Registry (org-level)
--   org이 자유롭게 정의하는 필드 (예: 직업, 종교, 추천경로 상세 등).
--   members.custom_fields jsonb에 저장 + 정의는 custom_field_definitions에 카탈로그.

create table if not exists custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- 적용 대상: members | promises | payments | campaigns
  entity_type text not null check (entity_type in ('members','promises','payments','campaigns')),
  field_key text not null,             -- API 키 (영문/숫자/언더바)
  label text not null,                 -- UI 라벨
  description text,
  -- 타입
  field_type text not null check (field_type in ('text','number','date','select','multiselect','boolean')),
  options jsonb,                       -- select/multiselect의 옵션 배열
  required boolean not null default false,
  -- 정렬 및 표시
  display_order integer not null default 100,
  visible_in_list boolean not null default false,
  visible_to_donor boolean not null default false,
  -- 검색 인덱스 여부 (자주 검색하는 필드)
  searchable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, entity_type, field_key)
);

create index if not exists idx_custom_field_definitions_entity
  on custom_field_definitions (org_id, entity_type, active);

-- members에 custom_fields jsonb 추가 (이미 일부 테이블에 있을 수 있음 — 조건부)
alter table members add column if not exists custom_fields jsonb default '{}'::jsonb;
alter table promises add column if not exists custom_fields jsonb default '{}'::jsonb;
alter table payments add column if not exists custom_fields jsonb default '{}'::jsonb;

-- 검색 가속화 (jsonb_path_ops index — 일반적인 등호 검색에 효과적)
create index if not exists idx_members_custom_fields
  on members using gin (custom_fields jsonb_path_ops);

alter table custom_field_definitions enable row level security;
drop policy if exists "custom_field_definitions_admin_all" on custom_field_definitions;
create policy "custom_field_definitions_admin_all" on custom_field_definitions
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "custom_field_definitions_donor_visible" on custom_field_definitions;
create policy "custom_field_definitions_donor_visible" on custom_field_definitions
  for select using (visible_to_donor = true);

comment on table custom_field_definitions is
  '기관별 커스텀 필드 정의 카탈로그. members/promises/payments/campaigns에 jsonb로 저장된 필드를 설명.';
comment on column members.custom_fields is
  '커스텀 필드 값 (key-value). custom_field_definitions에서 정의된 키만 유효.';
