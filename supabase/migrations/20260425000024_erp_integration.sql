-- ERP 회계 연동 고도화
--   1. 계정과목 마스터 (chart_of_accounts)
--   2. 회계 거래처 코드 (members.bp_code)
--   3. 수입결의 (revenue_journals)
--   4. 은행계좌 마스터 (bank_accounts) + 가상계좌 매핑
--   5. payments → programs 자동 분배 (payment_program_allocations)
--   6. 회계 마감 (closed_periods)
--   7. 분개 미리보기 (journal_lines view)

-- ============================================================================
-- 1. 계정과목 (Chart of Accounts)
-- ============================================================================
create table if not exists chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text not null,                      -- '4111', '11201' 등 (4=수익, 1=자산)
  name text not null,                      -- '지정기부금수익', '보통예금' 등
  account_type text not null
    check (account_type in ('asset','liability','equity','revenue','expense')),
  -- 기부금 종류 (수익 계정 한정)
  donation_kind text check (donation_kind in ('designated','non_designated','government','other')),
  parent_id uuid references chart_of_accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists idx_coa_org on chart_of_accounts (org_id, account_type, active);

-- 캠페인에 수익 계정 매핑 (모금 시 분개의 대변)
alter table campaigns add column if not exists revenue_account_id uuid references chart_of_accounts(id) on delete set null;
alter table campaigns add column if not exists donation_kind text
  check (donation_kind in ('designated','non_designated','government','other'));

-- ============================================================================
-- 2. 회계 거래처 코드 (BP code)
-- ============================================================================
alter table members add column if not exists bp_code text;  -- ERP 거래처 코드
alter table members add column if not exists bp_synced_at timestamptz;
create index if not exists idx_members_bp_code on members (org_id, bp_code) where bp_code is not null;

-- ============================================================================
-- 3. 수입결의 (Revenue Journal)
--    여러 payment를 묶어 한 건의 결의로 ERP에 전송
-- ============================================================================
create table if not exists revenue_journals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- 결의 번호 (org별 시퀀스, ERP 전표번호와 매핑)
  journal_no text not null,
  journal_date date not null,
  description text,
  total_amount numeric(14,2) not null default 0,
  payment_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft','approved','posted','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  posted_to_erp_at timestamptz,
  -- 외부 ERP 전표번호 (push 후 받아온 응답)
  external_voucher_no text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (org_id, journal_no)
);

create index if not exists idx_revenue_journals_org_date
  on revenue_journals (org_id, journal_date desc);
create index if not exists idx_revenue_journals_status
  on revenue_journals (org_id, status);

-- 결의-payment 라인
create table if not exists revenue_journal_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  journal_id uuid not null references revenue_journals(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete restrict,
  amount numeric(14,2) not null,
  -- 분개 정보 (스냅샷)
  debit_account_id uuid references chart_of_accounts(id) on delete set null,
  credit_account_id uuid references chart_of_accounts(id) on delete set null,
  bp_code text,
  program_id uuid references programs(id) on delete set null,
  unit_id uuid references org_units(id) on delete set null,
  notes text,
  unique (journal_id, payment_id)
);

create index if not exists idx_revenue_journal_lines_journal
  on revenue_journal_lines (journal_id);
create index if not exists idx_revenue_journal_lines_payment
  on revenue_journal_lines (payment_id);

-- ============================================================================
-- 4. 은행계좌 마스터 + 가상계좌 매핑
-- ============================================================================
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  bank_name text not null,
  account_no text not null,
  account_holder text,
  -- 회계 계정 매핑
  cash_account_id uuid references chart_of_accounts(id) on delete set null,
  -- 용도
  purpose text check (purpose in ('main','virtual_settlement','cms_settlement','grant','other')),
  -- 가상계좌 PG 연결
  pg_provider text,                        -- 'toss', 'kg' 등
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, bank_name, account_no)
);

-- payments에 입금 계좌 추가
alter table payments add column if not exists deposit_bank_account_id uuid references bank_accounts(id) on delete set null;
create index if not exists idx_payments_deposit_bank on payments (deposit_bank_account_id) where deposit_bank_account_id is not null;

-- 가상계좌 → 실 계좌 매핑 (입금 시 자동 분개에 사용)
create table if not exists virtual_account_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- 매칭 키 (가상계좌 패턴 또는 PG_method)
  virtual_account_pattern text,            -- '*_VBANK', 'KB-*' 등 (LIKE 패턴)
  pg_method text,                          -- 'CARD', 'TRANSFER', 'VIRTUAL_ACCOUNT'
  -- 매핑 결과
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  priority integer not null default 100,   -- 낮을수록 우선
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_va_mappings_org on virtual_account_mappings (org_id, active, priority);

-- ============================================================================
-- 5. payments → programs 자동 분배
-- ============================================================================
create table if not exists payment_program_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict,
  amount numeric(14,2) not null,
  -- 'auto'면 program_funding 룰로 자동 생성, 'manual'이면 수동 조정
  source text not null default 'auto' check (source in ('auto','manual')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_program_alloc_payment
  on payment_program_allocations (payment_id);
create index if not exists idx_payment_program_alloc_program
  on payment_program_allocations (program_id);

-- 한 payment의 모든 allocation 합 = payment.amount 가 되도록 응용 단에서 보장

-- ============================================================================
-- 6. 회계 마감 (Closed Periods)
-- ============================================================================
create table if not exists closed_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  closed_at timestamptz not null default now(),
  closed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  reopen_reason text,
  notes text,
  unique (org_id, period_start, period_end)
);

create index if not exists idx_closed_periods_org_active
  on closed_periods (org_id, period_end desc) where reopened_at is null;

-- 마감 기간 검사 함수
create or replace function is_period_closed(p_org_id uuid, p_date date)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from closed_periods
    where org_id = p_org_id
      and reopened_at is null
      and p_date between period_start and period_end
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table chart_of_accounts enable row level security;
alter table revenue_journals enable row level security;
alter table revenue_journal_lines enable row level security;
alter table bank_accounts enable row level security;
alter table virtual_account_mappings enable row level security;
alter table payment_program_allocations enable row level security;
alter table closed_periods enable row level security;

drop policy if exists "coa_admin_all" on chart_of_accounts;
create policy "coa_admin_all" on chart_of_accounts
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "revenue_journals_admin_all" on revenue_journals;
create policy "revenue_journals_admin_all" on revenue_journals
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "rjl_admin_all" on revenue_journal_lines;
create policy "rjl_admin_all" on revenue_journal_lines
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "bank_accounts_admin_all" on bank_accounts;
create policy "bank_accounts_admin_all" on bank_accounts
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "vam_admin_all" on virtual_account_mappings;
create policy "vam_admin_all" on virtual_account_mappings
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "ppa_admin_all" on payment_program_allocations;
create policy "ppa_admin_all" on payment_program_allocations
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "closed_periods_admin_all" on closed_periods;
create policy "closed_periods_admin_all" on closed_periods
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

comment on table chart_of_accounts is
  'ERP 계정과목 마스터. 캠페인의 수익계정/은행계좌의 자산계정과 매핑.';
comment on table revenue_journals is
  '수입결의: payments를 묶어 한 건의 회계 전표로 ERP에 전송.';
comment on table bank_accounts is
  '단체 보유 은행계좌. 가상계좌 정산/CMS 정산 등 용도별 분리.';
comment on table virtual_account_mappings is
  '결제 시 자동 입금 계좌 매핑. pg_method 또는 virtual_account_pattern으로 매칭.';
comment on table payment_program_allocations is
  'payment의 어느 부분이 어느 program으로 배분됐는지 추적. program_funding 룰로 자동 생성 가능.';
comment on table closed_periods is
  '회계 마감 기간. 마감된 기간의 payment 수정은 응용 단에서 차단.';
comment on function is_period_closed is
  '주어진 날짜가 마감된 기간에 속하는지 체크.';
