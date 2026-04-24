-- 자원봉사 활동 관리
--   members.member_type='volunteer' 인 회원의 활동 시간/장소/배치 기록.
--   1365 자원봉사 포털 연동 시 hours를 그쪽으로 전송하는 워크플로 기반.

create table if not exists volunteer_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  volunteer_id uuid not null references members(id) on delete cascade,
  activity_date date not null,
  activity_name text not null,
  location text,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  -- 배치된 사업/캠페인
  campaign_id uuid references campaigns(id) on delete set null,
  -- 1365 등 외부 인증
  external_certified boolean not null default false,
  external_cert_no text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_volunteer_activities_volunteer
  on volunteer_activities (volunteer_id, activity_date desc);
create index if not exists idx_volunteer_activities_org_date
  on volunteer_activities (org_id, activity_date desc);

alter table volunteer_activities enable row level security;

comment on table volunteer_activities is
  '자원봉사 활동 시간 기록. members.member_type=volunteer 와 결합해 사용.';
