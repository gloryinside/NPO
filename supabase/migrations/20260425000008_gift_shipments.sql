-- 기념품/감사품 발송 큐
--   1) gift_rules: 누적 후원금/지속 기간 달성 시 발송 트리거 정의
--   2) gift_shipments: 발송 대기/완료 큐 (cron이 채우고 어드민이 처리)

create table if not exists gift_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,                  -- 예: '100만원 누적 감사품'
  trigger_type text not null check (trigger_type in ('cumulative_amount','years_active','single_payment')),
  trigger_value numeric(14,2) not null,
  gift_name text not null,             -- 예: '머그컵 + 감사장'
  gift_description text,
  -- 기본 안내문 (감사장 본문 등)
  thank_message text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_gift_rules_org_active
  on gift_rules (org_id, active);

-- 발송 큐
create table if not exists gift_shipments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  rule_id uuid references gift_rules(id) on delete set null,
  gift_name text not null,             -- snapshot (rule 변경에도 보존)
  trigger_value numeric(14,2),         -- 트리거 시점의 누적값/기간
  -- 상태 흐름: queued → preparing → shipped | skipped
  status text not null default 'queued'
    check (status in ('queued','preparing','shipped','skipped')),
  -- 발송 정보
  shipping_address text,
  tracking_no text,
  shipped_at timestamptz,
  shipped_by uuid,
  -- 메모
  notes text,
  created_at timestamptz not null default now(),
  -- 동일 회원 + 동일 룰 중복 발송 방지
  unique (member_id, rule_id)
);

create index if not exists idx_gift_shipments_org_status
  on gift_shipments (org_id, status, created_at desc);

alter table gift_rules enable row level security;
alter table gift_shipments enable row level security;

comment on table gift_rules is
  '기념품 발송 트리거 룰. cumulative_amount=누적후원, years_active=지속기간, single_payment=단건금액';
comment on table gift_shipments is
  '기념품 발송 큐. 자동 트리거된 행을 어드민이 처리(주소 입력→shipped).';
