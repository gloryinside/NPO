-- 자동이체(CMS) 기반: 출금동의 기록 + 계좌 자동결제 사용 여부
--
-- 출금동의(전자금융거래법상 출금이체 동의) 증빙은 누가 돈을 걷든 필요하다.
--   - 지금: 외부 CMS 프로그램을 쓰는 기관이 종이·ARS·전자서명으로 받은 동의를 관리자가 기록
--   - 나중: 토스 계좌 자동결제(퀵계좌이체 빌링) 등록 창에서 받은 동의를 자동 기록(method = pg_registration)
-- 동의 철회는 행을 지우지 않고 revoked_at 으로 남긴다(분쟁 시 증빙).

create table if not exists withdrawal_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  promise_id uuid not null references promises(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  method text not null
    check (method in ('pg_registration', 'electronic_signature', 'ars_recording', 'paper')),
  -- 예금주(결제자)가 후원자와 다를 수 있다(가족 계좌 등)
  payer_name text not null,
  payer_relation text not null default 'self'
    check (payer_relation in ('self', 'spouse', 'parent', 'child', 'family', 'company', 'other')),
  -- 계좌는 원문을 저장하지 않는다 — 은행명과 끝 4자리만(확인·안내용)
  bank_name text,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  provider text,                -- 'toss' 등 — 등록을 처리한 곳
  provider_ref text,            -- 결제사 쪽 등록 번호 등
  evidence_path text,           -- 녹취·서명·스캔 파일 저장 위치(스토리지 경로)
  note text,
  consented_at timestamptz not null,
  recorded_by uuid,             -- 기록한 관리자(auth.users.id), 자동 기록은 null
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_consents_promise
  on withdrawal_consents (org_id, promise_id, consented_at desc);

-- 약정 하나에 유효한 동의는 하나만
create unique index if not exists uq_withdrawal_consents_active
  on withdrawal_consents (promise_id)
  where revoked_at is null;

alter table withdrawal_consents enable row level security;
-- 관리자 API(service_role)로만 접근
drop policy if exists withdrawal_consents_admin_only on withdrawal_consents;
create policy withdrawal_consents_admin_only on withdrawal_consents for select using (false);

-- 토스 계좌 자동결제 계약 후 켠다. 꺼져 있으면 자동이체 신청은 지금처럼 "접수 후 외부 CMS 청구"로 처리
alter table orgs
  add column if not exists account_billing_enabled boolean not null default false;

comment on table withdrawal_consents is
  '자동이체 출금동의 증빙. 철회는 revoked_at으로 남긴다. 계좌번호 원문은 저장하지 않는다';
comment on column orgs.account_billing_enabled is
  '토스 계좌 자동결제(퀵계좌이체 빌링) 사용 여부 — 계약 후 켬';
