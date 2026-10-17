-- 회원·약정·결제 번호(M-/P-/PMT-YYYYNNNNN) 발번을 DB 원자 카운터로
--
-- 문제: 라우트마다 "개수 + 1" 또는 "가장 최근 행 번호 + 1"로 번호를 만들었다.
--   - 동시에 두 건이 들어오면 같은 번호 → (org_id, *_code) 유니크 위반 → 첫 후원 결제 실패
--   - 회원 삭제 후엔 개수 + 1이 이미 있는 번호를 다시 냄
--   - 최근 행이 다른 형식(가져오기·테스트 코드)이면 1부터 다시 시작
-- 해결: (기관, 종류, 연도)별 카운터를 insert … on conflict … returning 한 문장으로 증가 — 행 잠금으로 직렬화된다.

create table if not exists code_counters (
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('member', 'promise', 'payment')),
  year int not null,
  last_seq int not null default 0,
  primary key (org_id, kind, year)
);
alter table code_counters enable row level security;
drop policy if exists code_counters_service_only on code_counters;
create policy code_counters_service_only on code_counters for select using (false);

-- 기존 번호 다음부터 시작(형식이 맞는 번호만 반영)
insert into code_counters (org_id, kind, year, last_seq)
select org_id, 'member', substring(member_code from '^M-(\d{4})\d{5}$')::int, max(substring(member_code from '^M-\d{4}(\d{5})$')::int)
from members where member_code ~ '^M-\d{9}$' group by 1, 3
on conflict (org_id, kind, year) do update set last_seq = greatest(code_counters.last_seq, excluded.last_seq);

insert into code_counters (org_id, kind, year, last_seq)
select org_id, 'promise', substring(promise_code from '^P-(\d{4})\d{5}$')::int, max(substring(promise_code from '^P-\d{4}(\d{5})$')::int)
from promises where promise_code ~ '^P-\d{9}$' group by 1, 3
on conflict (org_id, kind, year) do update set last_seq = greatest(code_counters.last_seq, excluded.last_seq);

insert into code_counters (org_id, kind, year, last_seq)
select org_id, 'payment', substring(payment_code from '^PMT-(\d{4})\d{5}$')::int, max(substring(payment_code from '^PMT-\d{4}(\d{5})$')::int)
from payments where payment_code ~ '^PMT-\d{9}$' group by 1, 3
on conflict (org_id, kind, year) do update set last_seq = greatest(code_counters.last_seq, excluded.last_seq);

-- p_count개를 한 번에 예약하고 그 마지막 번호를 돌려준다(첫 번호 = 반환값 - p_count + 1)
create or replace function next_code_seq(p_org uuid, p_kind text, p_year int, p_count int default 1)
returns int
language sql
security definer
set search_path = public
as $$
  insert into code_counters (org_id, kind, year, last_seq) values (p_org, p_kind, p_year, greatest(p_count, 1))
  on conflict (org_id, kind, year) do update set last_seq = code_counters.last_seq + greatest(p_count, 1)
  returning last_seq;
$$;

revoke execute on function next_code_seq(uuid, text, int, int) from public, anon, authenticated;
grant execute on function next_code_seq(uuid, text, int, int) to service_role;
