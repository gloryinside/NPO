-- 법인 후원자 정보 강화 — 세금계산서/기부금명세서 발행 준비
--   member_type='corporate' 인 회원에 대한 법인 정보를 보강.

alter table members add column if not exists business_reg_no text; -- 사업자등록번호 (10자리)
alter table members add column if not exists corp_legal_name text;  -- 법인명
alter table members add column if not exists ceo_name text;          -- 대표자명
alter table members add column if not exists biz_type text;          -- 종목 (예: 정보통신업)
alter table members add column if not exists biz_category text;      -- 업태 (예: 도소매)
alter table members add column if not exists biz_address text;       -- 사업장 주소
alter table members add column if not exists tax_invoice_email text; -- 세금계산서 수신 이메일
alter table members add column if not exists tax_invoice_required boolean not null default false;

create index if not exists idx_members_brn
  on members (org_id, business_reg_no)
  where business_reg_no is not null;

comment on column members.business_reg_no is
  '사업자등록번호 (10자리, 하이픈 제거 저장). 법인 후원자만 사용.';
comment on column members.tax_invoice_required is
  'true면 결제 시 세금계산서 발행 의무. 어드민 큐에 자동 노출.';

-- 세금계산서 발행 큐
create table if not exists tax_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  payment_id uuid references payments(id) on delete set null,
  -- 세금계산서 정보 (snapshot — 회원 정보 변경 후에도 보존)
  business_reg_no text not null,
  corp_legal_name text not null,
  ceo_name text,
  biz_address text,
  tax_invoice_email text,
  amount numeric(14,2) not null,
  issue_date date,
  invoice_no text,                     -- 발행 번호
  status text not null default 'pending'
    check (status in ('pending','issued','sent','cancelled')),
  -- 외부 시스템 발행 시 ID
  external_provider text,              -- 'popbill' | 'kakao' | 'manual' 등
  external_invoice_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tax_invoices_org_status
  on tax_invoices (org_id, status, created_at desc);
create index if not exists idx_tax_invoices_member
  on tax_invoices (member_id);

alter table tax_invoices enable row level security;

comment on table tax_invoices is
  '세금계산서 발행 큐. 법인 후원자(tax_invoice_required=true)의 결제 발생 시 자동 생성.';
