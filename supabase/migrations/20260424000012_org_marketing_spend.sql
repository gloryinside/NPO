-- G-D161: 기관별 월간 마케팅 지출 기록 (CAC 계산용)

create table if not exists org_marketing_spend (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  amount bigint not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, year, month)
);

create index if not exists idx_org_marketing_spend_org_period
  on org_marketing_spend (org_id, year desc, month desc);

alter table org_marketing_spend enable row level security;
drop policy if exists org_marketing_spend_service_only on org_marketing_spend;
create policy org_marketing_spend_service_only on org_marketing_spend for select using (false);

comment on table org_marketing_spend is
  'G-D161 기관별 월별 마케팅 지출 (KRW). CAC = 월간 지출 / 월간 신규 후원자 수';
