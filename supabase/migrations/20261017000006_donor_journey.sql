-- 후원자 여정 메시지 — 정해진 시점(시작 다음 날, 7일 뒤, 첫 후원 한 달 뒤, 1주년, 생일)에 보내는 안내
--
--   journey_steps : 기관별 단계 설정(켜기/끄기, 제목·본문). 행이 없으면 lib/journey/steps 의 기본값을 쓴다.
--   journey_sends : 보낸 기록. (기관, 단계, 후원자, 기간) 유일 — 매일 도는 작업이 여러 번 돌아도 한 번만 보낸다.
--   channel 은 지금 email 만 쓴다. alimtalk 은 카카오 연동 후 켠다.

create table if not exists journey_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  step_key text not null
    check (step_key in ('welcome_d1', 'intro_d7', 'thanks_30d', 'anniversary', 'birthday')),
  enabled boolean not null default false,
  channel text not null default 'email' check (channel in ('email', 'alimtalk')),
  subject text not null,
  body text not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (org_id, step_key)
);

create table if not exists journey_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  step_key text not null,
  member_id uuid not null references members(id) on delete cascade,
  -- 같은 단계를 다시 보낼 수 있는 단위: 약정 id(시작 안내), 'once'(첫 후원 감사), 연도(1주년·생일)
  period_key text not null,
  channel text not null default 'email',
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  unique (org_id, step_key, member_id, period_key)
);

create index if not exists idx_journey_sends_org_step
  on journey_sends (org_id, step_key, sent_at desc);

alter table journey_steps enable row level security;
alter table journey_sends enable row level security;
-- 관리자 API(service_role)로만 접근
drop policy if exists journey_steps_admin_only on journey_steps;
create policy journey_steps_admin_only on journey_steps for select using (false);
drop policy if exists journey_sends_admin_only on journey_sends;
create policy journey_sends_admin_only on journey_sends for select using (false);

-- 오늘(월·일)에 해당하는 생일 후원자 — 2/29생은 평년 2/28에 넣도록 p_days 로 여러 날을 받는다
create or replace function journey_birthday_members(p_org uuid, p_month int, p_days int[])
returns table (id uuid, name text, email text)
language sql stable
set search_path = public
as $$
  select m.id, m.name, m.email
  from members m
  where m.org_id = p_org
    and m.birth_date is not null
    and extract(month from m.birth_date) = p_month
    and extract(day from m.birth_date) = any (p_days)
    and coalesce(m.status, 'active') = 'active'
    and m.email is not null
    and coalesce(m.email_disabled, false) = false
$$;

-- 오늘이 시작 기념일인 진행 중 정기후원(1년 이상)
create or replace function journey_anniversary_promises(p_org uuid, p_month int, p_days int[], p_today date)
returns table (promise_id uuid, member_id uuid, amount bigint, started_at date)
language sql stable
set search_path = public
as $$
  select p.id, p.member_id, p.amount::bigint, p.started_at
  from promises p
  where p.org_id = p_org
    and p.type = 'regular'
    and p.status = 'active'
    and p.started_at <= (p_today - interval '1 year')
    and extract(month from p.started_at) = p_month
    and extract(day from p.started_at) = any (p_days)
$$;

-- 개인정보를 돌려주므로 서버(service_role)만 호출
revoke all on function journey_birthday_members(uuid, int, int[]) from public, anon, authenticated;
revoke all on function journey_anniversary_promises(uuid, int, int[], date) from public, anon, authenticated;
grant execute on function journey_birthday_members(uuid, int, int[]) to service_role;
grant execute on function journey_anniversary_promises(uuid, int, int[], date) to service_role;

comment on table journey_steps is '후원자 여정 메시지 단계 설정(기관별). 행이 없으면 기본값';
comment on table journey_sends is '후원자 여정 메시지 발송 기록 — (기관, 단계, 후원자, 기간) 유일';
