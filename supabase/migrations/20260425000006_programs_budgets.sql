-- 사업(프로그램) 예산/집행 관리
--   campaign(모금 단위)과 분리. 사업은 연속 운영되며 예산-집행으로 회계됨.
--   campaign.amount 가 program 예산으로 배정될 수 있음 (program_funding 매핑).

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  code text,                          -- 회계 코드 (예: PRG-2026-001)
  description text,
  fiscal_year integer not null,
  budget_total numeric(14,2) not null default 0,
  status text not null default 'active'
    check (status in ('planning','active','closed','cancelled')),
  start_date date,
  end_date date,
  manager_id uuid,                    -- 사업 담당자
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists idx_programs_org_year
  on programs (org_id, fiscal_year, status);

-- 예산 항목 (세부 카테고리: 인건비/사업비/관리비 등)
create table if not exists program_budget_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  category text not null,             -- '인건비','사업비','관리비','시설비' 등
  item_name text not null,
  budget_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_program_budget_items_program
  on program_budget_items (program_id);

-- 집행 내역 (실제 지출)
create table if not exists program_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  budget_item_id uuid references program_budget_items(id) on delete set null,
  expense_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text not null,
  vendor text,                         -- 지급처
  receipt_url text,                    -- 영수증 첨부
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_program_expenses_program_date
  on program_expenses (program_id, expense_date desc);

-- 캠페인 → 사업 자금 배정 (해당 캠페인 모금액의 일부/전부가 사업 예산으로 흘러들어감)
create table if not exists program_funding (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  -- 배분 방식: percent(모금액의 N%) 또는 amount(고정 금액)
  allocation_type text not null check (allocation_type in ('percent','amount')),
  allocation_value numeric(14,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (program_id, campaign_id)
);

alter table programs enable row level security;
alter table program_budget_items enable row level security;
alter table program_expenses enable row level security;
alter table program_funding enable row level security;

comment on table programs is
  '사업/프로그램 마스터. 회계 단위로 예산-집행 관리.';
comment on table program_funding is
  '캠페인 모금액이 어느 사업으로 배정되는지 매핑 (예: 캠페인A 모금액의 70%가 프로그램X로).';
