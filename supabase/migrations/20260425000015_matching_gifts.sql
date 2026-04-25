-- 매칭 기부 (Matching Gift)
--   기업이 직원의 기부에 매칭하는 프로그램.
--   matching_programs: 기업별 매칭 룰 (배율/한도)
--   matching_requests: 직원이 신청, 기업이 승인 → 기업의 매칭 결제 발생

create table if not exists matching_programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- 매칭하는 기업 (members.member_type='corporate' 인 회원과 연결)
  corporate_member_id uuid not null references members(id) on delete restrict,
  name text not null,                  -- '삼성전자 매칭 프로그램'
  -- 매칭 룰
  match_ratio numeric(5,2) not null default 1.0,   -- 1:1 = 1.0, 2:1 = 2.0
  per_donor_annual_cap numeric(14,2),  -- 직원 1인당 연간 매칭 한도
  total_annual_cap numeric(14,2),      -- 프로그램 전체 연간 한도
  active boolean not null default true,
  active_from date,
  active_to date,
  contact_email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_matching_programs_org_active
  on matching_programs (org_id, active);

create table if not exists matching_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  program_id uuid not null references matching_programs(id) on delete cascade,
  -- 직원(=후원자) 결제 건
  donor_member_id uuid not null references members(id) on delete restrict,
  donor_payment_id uuid not null references payments(id) on delete restrict,
  donor_amount numeric(14,2) not null,
  -- 매칭 요청
  requested_match_amount numeric(14,2) not null,
  -- 상태 흐름: pending → approved | rejected → fulfilled (기업 결제 완료)
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','fulfilled')),
  -- 기업 측 처리
  approved_by_email text,             -- 기업 담당자 이메일
  approved_at timestamptz,
  rejected_reason text,
  -- 매칭 결제 (기업이 송금 후 어드민이 연결)
  match_payment_id uuid references payments(id) on delete set null,
  fulfilled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (donor_payment_id)
);

create index if not exists idx_matching_requests_org_status
  on matching_requests (org_id, status, created_at desc);
create index if not exists idx_matching_requests_program
  on matching_requests (program_id);

alter table matching_programs enable row level security;
alter table matching_requests enable row level security;

-- RLS
drop policy if exists "matching_programs_admin_all" on matching_programs;
create policy "matching_programs_admin_all" on matching_programs
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "matching_requests_admin_all" on matching_requests;
create policy "matching_requests_admin_all" on matching_requests
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- donor 본인 매칭 요청 조회
drop policy if exists "matching_requests_self_read" on matching_requests;
create policy "matching_requests_self_read" on matching_requests
  for select using (
    donor_member_id in (select id from members where supabase_uid = auth.uid())
  );

comment on table matching_programs is
  '기업 매칭 기부 프로그램. corporate_member_id로 기업 후원자 연결, match_ratio로 매칭 배율 정의.';
comment on table matching_requests is
  '직원의 매칭 신청 → 기업 승인 → 기업의 매칭 결제까지 추적.';
