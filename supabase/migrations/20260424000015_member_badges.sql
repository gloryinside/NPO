-- G-D160: 후원자 뱃지 (게임화)
--   badge_code 예시:
--     - founding_supporter (기관 설립 1년 이내 가입)
--     - supporter_1y / supporter_3y / supporter_5y
--     - major_donor (누적 1백만 / 5백만 / 1천만)
--     - loyal_recurring (정기후원 12개월 연속)
--   granted_at 은 최초 취득 시점. awarded_by 는 admin 수동 또는 'system'.

create table if not exists member_badges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  badge_code text not null,
  awarded_by text not null default 'system',
  note text,
  granted_at timestamptz not null default now(),
  unique (member_id, badge_code)
);

create index if not exists idx_member_badges_member
  on member_badges (member_id, granted_at desc);
create index if not exists idx_member_badges_org_badge
  on member_badges (org_id, badge_code);

alter table member_badges enable row level security;
drop policy if exists member_badges_self_read on member_badges;
create policy member_badges_self_read on member_badges for select
  using (exists (select 1 from members m where m.id = member_badges.member_id and m.supabase_uid = auth.uid()));

comment on table member_badges is
  'G-D160 후원자 뱃지. code 는 시스템 enum (코드 레벨 참조)';
