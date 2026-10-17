-- 관리자 권한(app_metadata) 부여 전 검토용 — 20261016000002의 자동 승격을 대체
--   select * from admin_claim_candidates;                          -- user_metadata엔 admin인데 app_metadata엔 아닌 계정
--   select grant_admin_claims(array['<user uuid>', ...]::uuid[]);   -- 운영자가 확인한 계정만 부여
-- user_metadata는 본인이 바꿀 수 있으므로 후보 목록 자체를 믿지 말고, 실제 관리자인지 사람이 확인한다.

create or replace view admin_claim_candidates as
select u.id, u.email, u.created_at, u.last_sign_in_at,
       u.raw_user_meta_data->>'org_id' as claimed_org_id,
       o.slug as claimed_org_slug,
       exists (select 1 from public.members m where m.supabase_uid = u.id) as is_donor
from auth.users u
left join public.orgs o on o.id::text = u.raw_user_meta_data->>'org_id'
where (u.raw_user_meta_data->>'role') = 'admin'
  and coalesce(u.raw_app_meta_data->>'role', '') <> 'admin';

revoke all on admin_claim_candidates from public, anon, authenticated;
grant select on admin_claim_candidates to service_role;

create or replace function grant_admin_claims(p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update auth.users u
  set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'admin', 'org_id', u.raw_user_meta_data->>'org_id')
  where u.id = any(p_user_ids)
    and (u.raw_user_meta_data->>'org_id') ~ '^[0-9a-fA-F-]{36}$'
    and exists (select 1 from public.orgs o where o.id = (u.raw_user_meta_data->>'org_id')::uuid);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function grant_admin_claims(uuid[]) from public, anon, authenticated;
grant execute on function grant_admin_claims(uuid[]) to service_role;

