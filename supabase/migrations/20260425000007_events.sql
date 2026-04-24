-- 행사/이벤트 관리
--   후원자의 밤, 정기 모임, 봉사 행사, 모금 갈라 등.
--   회원/비회원 모두 참석 가능 (게스트 등록).

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null,
  description text,
  event_type text default 'meetup'
    check (event_type in ('meetup','gala','volunteer','workshop','briefing','other')),
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  capacity integer,
  registration_required boolean not null default true,
  registration_deadline timestamptz,
  status text not null default 'planning'
    check (status in ('planning','open','closed','completed','cancelled')),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_org_status_date
  on events (org_id, status, start_at desc);

-- 참석자 (회원 또는 게스트)
create table if not exists event_attendances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  -- 비회원 게스트
  guest_name text,
  guest_phone text,
  guest_email text,
  party_size integer not null default 1 check (party_size > 0),
  -- 상태: registered → checked_in | no_show | cancelled
  status text not null default 'registered'
    check (status in ('registered','checked_in','no_show','cancelled')),
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  notes text
);

create index if not exists idx_event_attendances_event
  on event_attendances (event_id, status);
create index if not exists idx_event_attendances_member
  on event_attendances (member_id) where member_id is not null;

alter table events enable row level security;
alter table event_attendances enable row level security;

comment on table events is
  '행사/이벤트 마스터. 후원자 모임, 봉사 행사, 갈라 등.';
comment on table event_attendances is
  '행사 참석자 — 회원이면 member_id, 비회원이면 guest_* 필드 사용.';
