-- 이메일 템플릿 버전 관리 + AB 테스트 + 다국어
--   email_template_versions: 변경 이력 (롤백 가능)
--   email_templates에 lang/variant/parent_id 추가

alter table email_templates add column if not exists lang text default 'ko';
alter table email_templates add column if not exists variant text;          -- AB 테스트용 (A/B/null)
alter table email_templates add column if not exists ab_weight integer default 50; -- 0-100
alter table email_templates add column if not exists parent_id uuid;        -- AB 그룹의 베이스 템플릿

-- 기존 UNIQUE 제약 (org_id, scenario) 를 (org_id, scenario, lang, variant) 로 확장
alter table email_templates drop constraint if exists email_templates_org_id_scenario_key;
create unique index if not exists email_templates_unique_org_scenario_lang_variant
  on email_templates (org_id, scenario, lang, coalesce(variant, ''));

-- 버전 이력
create table if not exists email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references email_templates(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  version integer not null,
  subject text not null,
  body_json jsonb not null,
  body_html text,
  changed_by uuid,
  change_note text,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create index if not exists idx_email_template_versions_template
  on email_template_versions (template_id, version desc);

alter table email_template_versions enable row level security;

drop policy if exists "email_template_versions_admin_all" on email_template_versions;
create policy "email_template_versions_admin_all" on email_template_versions
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- AB 테스트 노출 로그 (어떤 variant가 발송됐는지)
create table if not exists email_ab_dispatches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  template_id uuid not null references email_templates(id) on delete cascade,
  recipient_email text not null,
  variant text,
  ref_kind text,                  -- 'payment', 'promise', 'campaign' 등
  ref_id uuid,
  -- 후속 이벤트 추적 (open/click 콜백으로 갱신)
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_ab_dispatches_template
  on email_ab_dispatches (template_id, created_at desc);

alter table email_ab_dispatches enable row level security;
drop policy if exists "email_ab_dispatches_admin_all" on email_ab_dispatches;
create policy "email_ab_dispatches_admin_all" on email_ab_dispatches
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

comment on column email_templates.lang is
  '템플릿 언어 (ko/en/ja/zh 등). 후원자 lang 설정과 매칭.';
comment on column email_templates.variant is
  'AB 테스트 변형 ID (A/B/null). null=기본, A/B=경쟁 변형. ab_weight로 분배.';
comment on table email_template_versions is
  '템플릿 변경 이력. 롤백/감사용. UPDATE 시 트리거 또는 응용 단에서 INSERT.';
comment on table email_ab_dispatches is
  '발송 이력 — variant별 open/click 측정으로 우승 variant 결정.';
