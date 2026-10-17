-- 동의 기록 — 후원 신청 때 받은 동의(약관·개인정보 수집이용·만 14세 이상·마케팅·주민번호)를 문구 판과 함께 남긴다.
-- 개인정보 처리 동의는 받은 쪽이 입증해야 하므로 신청 한 건마다 남기고, 고치지 않는다(추가만).
create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  kind text not null check (kind in ('terms', 'privacy', 'over14', 'marketing', 'rrn')),
  granted boolean not null,
  version text not null,
  source text not null,              -- 'donation_form' | 'f2f' 등
  created_at timestamptz not null default now()
);
create index if not exists idx_consent_records_member on consent_records (org_id, member_id, created_at desc);
alter table consent_records enable row level security;
drop policy if exists consent_records_admin_only on consent_records;
create policy consent_records_admin_only on consent_records for select using (false);
comment on table consent_records is '후원 신청 동의 기록 — lib/legal/consent (추가만, 수정·삭제 안 함)';
