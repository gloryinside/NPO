-- G-D129: 신용카드 분쟁(chargeback) 케이스 관리
--   - Toss webhook 또는 수동 등록을 통해 케이스 생성
--   - status: open → evidence_submitted → won/lost → closed
--   - members.chargeback_risk 플래그로 신규 후원·재청구 보수적 처리

create table if not exists chargebacks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  amount bigint not null,
  reason_code text,
  reason_text text,
  status text not null default 'open'
    check (status in ('open','evidence_submitted','won','lost','closed')),
  toss_case_id text,
  evidence_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_chargebacks_payment on chargebacks (payment_id);
create index if not exists idx_chargebacks_org_status
  on chargebacks (org_id, status, created_at desc);

alter table chargebacks enable row level security;
-- admin 전용 — service_role 로만 접근
drop policy if exists chargebacks_admin_only on chargebacks;
create policy chargebacks_admin_only on chargebacks for select using (false);

alter table members
  add column if not exists chargeback_risk boolean not null default false;

comment on table chargebacks is
  'G-D129 카드 분쟁(chargeback) 케이스. Toss webhook 또는 수동 등록';
comment on column members.chargeback_risk is
  'G-D129 분쟁 이력 있는 회원 표식. 재청구·신규 후원 시 admin 검토 권장';
