-- 모금 채널/모금함 추적
--   채널 마스터(donation_channels) + payments에 channel_id FK 추가.
--   보고서에서 채널별 모금액 집계 가능.

create table if not exists donation_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text not null,                  -- 'box-myeongdong-01' 등 식별자
  name text not null,                  -- '명동 1번 모금함'
  channel_type text not null
    check (channel_type in ('box','street','booth','online','partner','other')),
  -- 위치/메타
  location text,
  manager_name text,
  manager_phone text,
  -- 활성 기간
  active_from date,
  active_to date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists idx_donation_channels_org_active
  on donation_channels (org_id, active);

-- payments에 채널 연결
alter table payments add column if not exists channel_id uuid references donation_channels(id) on delete set null;

create index if not exists idx_payments_channel
  on payments (channel_id) where channel_id is not null;

-- 모금함 정산 — 거리모금/모금함 등 현금 회수 시 정산 기록
create table if not exists channel_settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel_id uuid not null references donation_channels(id) on delete cascade,
  settlement_date date not null,
  -- 회수액
  cash_amount numeric(14,2) not null default 0,
  count_donors integer,                -- 익명 모금함이면 추정값
  collected_by text,                   -- 회수자
  deposited_to_bank boolean not null default false,
  bank_deposit_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_settlements_channel
  on channel_settlements (channel_id, settlement_date desc);

alter table donation_channels enable row level security;
alter table channel_settlements enable row level security;

comment on table donation_channels is
  '모금 채널/모금함 마스터. 거리모금, 매장 모금함, 부스 등 오프라인 채널 추적.';
comment on table channel_settlements is
  '모금함 회수 정산 — 익명 현금 모금의 회수→은행입금 흐름.';
