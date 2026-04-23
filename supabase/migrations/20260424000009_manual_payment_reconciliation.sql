-- G-D130: 수기 결제(계좌이체/CMS/현금) 입금 대사
--   은행 CSV를 업로드하면 bank_statements 에 import → payments 의 manual 건과 매칭.
--   매칭된 건은 pay_status='paid' + deposit_date 기록, 미매칭 건은 운영팀이 조정.

create table if not exists bank_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  statement_date date not null,
  counterparty text,       -- 이체인 이름
  amount bigint not null,  -- + 입금, - 출금
  memo text,
  bank_ref text,           -- 거래 고유번호
  raw jsonb,
  matched_payment_id uuid references payments(id) on delete set null,
  matched_at timestamptz,
  matched_by uuid,
  imported_at timestamptz not null default now(),
  import_batch_id uuid    -- 한 번의 CSV 업로드 단위 (묶음 롤백용)
);

create index if not exists idx_bank_statements_org_date
  on bank_statements (org_id, statement_date desc);
create index if not exists idx_bank_statements_unmatched
  on bank_statements (org_id, matched_at)
  where matched_at is null and amount > 0;
create unique index if not exists uq_bank_statements_bank_ref
  on bank_statements (org_id, bank_ref) where bank_ref is not null;

alter table bank_statements enable row level security;
drop policy if exists bank_statements_admin_only on bank_statements;
create policy bank_statements_admin_only on bank_statements for select using (false);

comment on table bank_statements is
  'G-D130 은행 거래내역. matched_payment_id 로 수기 결제와 연결';
