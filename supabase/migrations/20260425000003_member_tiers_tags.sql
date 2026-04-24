-- 회원 등급(tier) + 태그(tags) 시스템
--   tier: 후원금 누적/지속기간 기반 자동 분류 (단일값)
--   tags: 어드민이 자유롭게 부여하는 라벨 (다대다)

-- 1. members.tier (자동 분류 결과)
alter table members add column if not exists tier text
  check (tier in ('bronze','silver','gold','platinum','diamond')) default 'bronze';
alter table members add column if not exists tier_overridden boolean not null default false;
alter table members add column if not exists tier_updated_at timestamptz;

create index if not exists idx_members_tier on members (org_id, tier);

comment on column members.tier is
  '후원자 등급. cron으로 자동 분류되나 tier_overridden=true면 어드민 수동 지정 보존.';
comment on column members.tier_overridden is
  'true면 자동 분류 cron이 이 회원의 tier를 덮어쓰지 않음.';

-- 2. member_tags 마스터 (org별 태그 정의)
create table if not exists member_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  description text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists idx_member_tags_org on member_tags (org_id);
alter table member_tags enable row level security;

-- 3. member_tag_assignments (다대다)
create table if not exists member_tag_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  tag_id uuid not null references member_tags(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  unique (member_id, tag_id)
);

create index if not exists idx_mta_member on member_tag_assignments (member_id);
create index if not exists idx_mta_tag on member_tag_assignments (tag_id);
alter table member_tag_assignments enable row level security;

comment on table member_tags is
  '회원 태그 마스터 (예: VIP, 임원, 만난적있음 등 어드민이 자유 정의).';
comment on table member_tag_assignments is
  '회원-태그 다대다 매핑. 한 회원이 여러 태그를 가질 수 있음.';
