-- 조건 저장형 후원자 명단 — "미납 2회 이상", "정기후원 1년 이상 + 마케팅 동의" 같은 조건을 이름 붙여 저장하고 다시 연다.
--   member_segments.filters : lib/members/segments 의 SegmentFilter(JSON). 앱에서 검증한 값만 저장한다.
--   segment_member_ids()    : 조건에 맞는 후원자 id. 여러 표(약정·결제·태그)를 한 번에 보려고 SQL 함수로 둔다.

create table if not exists member_segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  filters jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

alter table member_segments enable row level security;
drop policy if exists member_segments_admin_only on member_segments;
create policy member_segments_admin_only on member_segments for select using (false);

create or replace function segment_member_ids(p_org uuid, p_f jsonb, p_today date)
returns table (member_id uuid)
language sql stable
set search_path = public
as $$
  select m.id
  from members m
  where m.org_id = p_org
    and (p_f->>'status' is null or m.status = p_f->>'status')
    and (p_f->>'member_type' is null or m.member_type = p_f->>'member_type')
    and (p_f->'tiers' is null or m.tier in (select jsonb_array_elements_text(p_f->'tiers')))
    and (p_f->>'join_path' is null or m.join_path = p_f->>'join_path')
    and (p_f->>'birthday_month' is null or extract(month from m.birth_date) = (p_f->>'birthday_month')::int)
    and (p_f->>'marketing_consent' is null
         or coalesce(m.marketing_consent, false) = (p_f->>'marketing_consent')::boolean)
    and (p_f->>'tag_id' is null or exists (
          select 1 from member_tag_assignments a
          where a.org_id = p_org and a.member_id = m.id and a.tag_id = (p_f->>'tag_id')::uuid))
    and (p_f->>'has_active_regular' is null
         or (p_f->>'has_active_regular')::boolean = exists (
          select 1 from promises p
          where p.org_id = p_org and p.member_id = m.id and p.type = 'regular' and p.status = 'active'))
    and (p_f->>'pay_method' is null or exists (
          select 1 from promises p
          where p.org_id = p_org and p.member_id = m.id and p.status = 'active' and p.pay_method = p_f->>'pay_method'))
    and (p_f->>'regular_months_min' is null or exists (
          select 1 from promises p
          where p.org_id = p_org and p.member_id = m.id and p.type = 'regular' and p.status = 'active'
            and p.started_at <= p_today - make_interval(months => (p_f->>'regular_months_min')::int)))
    -- 최근 6개월 결제 실패·미납 건수
    and (p_f->>'unpaid_min' is null or (
          select count(*) from payments y
          where y.org_id = p_org and y.member_id = m.id and y.pay_status in ('failed', 'unpaid')
            and y.pay_date > p_today - 183 and y.pay_date <= p_today) >= (p_f->>'unpaid_min')::int)
    -- 마지막 후원(결제 완료) 뒤로 N일 이상 — 한 번도 없으면 해당
    and (p_f->>'last_gift_days_min' is null or coalesce((
          select max(y.pay_date) from payments y
          where y.org_id = p_org and y.member_id = m.id and y.pay_status = 'paid'), date '1900-01-01')
          <= p_today - (p_f->>'last_gift_days_min')::int)
$$;

revoke all on function segment_member_ids(uuid, jsonb, date) from public, anon, authenticated;
grant execute on function segment_member_ids(uuid, jsonb, date) to service_role;

comment on table member_segments is '조건 저장형 후원자 명단 — filters는 lib/members/segments 검증값';
