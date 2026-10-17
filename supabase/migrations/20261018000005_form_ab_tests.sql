-- 후원 신청 화면 A/B 비교 — 캠페인 신청 화면의 금액 버튼(과 기본 후원 유형)을 두 가지로 나눠 보여 주고 비교한다.
--   form_ab_tests  : 캠페인당 진행 중 실험은 하나. variants = [{key:'A'|'B', amountPresets:int[], defaultType}]
--                    A는 보통 캠페인 설정 그대로(amountPresets 비움), B가 바꿔 보는 안
--   form_ab_views  : 방문자(브라우저 임의 id의 해시)별 첫 노출 1건 — 같은 사람이 여러 번 봐도 1
--   payments.ab_test_id / ab_variant : 신청이 어느 안에서 나왔는지
create table if not exists form_ab_tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  variants jsonb not null,
  status text not null default 'running' check (status in ('running', 'stopped')),
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_form_ab_running on form_ab_tests (campaign_id) where status = 'running';
create index if not exists idx_form_ab_tests_org on form_ab_tests (org_id, created_at desc);
alter table form_ab_tests enable row level security;
drop policy if exists form_ab_tests_admin_only on form_ab_tests;
create policy form_ab_tests_admin_only on form_ab_tests for select using (false);

create table if not exists form_ab_views (
  test_id uuid not null references form_ab_tests(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  visitor_hash text not null,
  variant text not null check (variant in ('A', 'B')),
  created_at timestamptz not null default now(),
  primary key (test_id, visitor_hash)
);
alter table form_ab_views enable row level security;
drop policy if exists form_ab_views_admin_only on form_ab_views;
create policy form_ab_views_admin_only on form_ab_views for select using (false);

alter table payments add column if not exists ab_test_id uuid references form_ab_tests(id) on delete set null;
alter table payments add column if not exists ab_variant text check (ab_variant is null or ab_variant in ('A', 'B'));
create index if not exists idx_payments_ab on payments (ab_test_id, ab_variant) where ab_test_id is not null;

comment on table form_ab_tests is '후원 신청 화면 A/B 비교 — lib/ab/form-test';
