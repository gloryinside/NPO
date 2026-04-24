-- DM/우편물 발송 캠페인
--   세그먼트 기반 명단 추출 → 발송 이력 트래킹.
--   members.address_disabled = true 인 회원은 수신 거부.

alter table members add column if not exists address_disabled boolean not null default false;
alter table members add column if not exists address_disabled_reason text;

create table if not exists mail_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,                  -- 예: '2026 봄 뉴스레터'
  description text,
  -- 세그먼트 필터 (JSON)
  --  { "tier": ["gold","platinum"],
  --    "tag_ids": ["..."],
  --    "min_total_paid": 100000,
  --    "active_only": true }
  segment_filter jsonb,
  -- 상태
  status text not null default 'planning'
    check (status in ('planning','exported','sent','cancelled')),
  recipient_count integer not null default 0,
  exported_at timestamptz,
  exported_by uuid,
  -- 발송 결과
  sent_at date,
  delivered_count integer,
  returned_count integer,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mail_campaigns_org_status
  on mail_campaigns (org_id, status, created_at desc);

-- 발송 이력 (회원별 — 중복 발송 추적용)
create table if not exists mail_dispatches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references mail_campaigns(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  -- snapshot (회원 주소 변경 후에도 보존)
  snapshot_address text,
  status text not null default 'pending'
    check (status in ('pending','sent','returned','undeliverable')),
  returned_reason text,
  created_at timestamptz not null default now(),
  unique (campaign_id, member_id)
);

create index if not exists idx_mail_dispatches_member
  on mail_dispatches (member_id, created_at desc);
create index if not exists idx_mail_dispatches_campaign
  on mail_dispatches (campaign_id, status);

alter table mail_campaigns enable row level security;
alter table mail_dispatches enable row level security;

comment on table mail_campaigns is
  '우편 발송 캠페인. segment_filter로 명단 추출, mail_dispatches에 발송 이력 기록.';
comment on column members.address_disabled is
  'true면 우편 발송 명단에서 자동 제외. 반송/주소불명/수신거부 시 설정.';
