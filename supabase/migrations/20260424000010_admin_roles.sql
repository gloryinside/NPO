-- G-D150: 관리자 역할 세분화 (role-based access control)
--   Supabase auth.users.user_metadata.role 은 기존 'admin' 만 존재 (bool 역할).
--   여기에 세부 역할(admin_roles) 테이블을 두고, 코드에서 세분화 권한 체크.
--
-- 역할:
--   - super:            모든 권한 (환불 최종 승인·키 회전 등)
--   - campaign_manager: 캠페인 CMS, 회원 열람, 응원 moderation
--   - finance:          결제·환불·영수증·재무 리포트
--   - support:          회원 상세·커뮤니케이션(응원 moderation 포함)
--
-- 한 admin 이 여러 role 보유 가능 (admin_roles 복수 행).

create table if not exists admin_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,          -- auth.users.id
  role text not null check (role in ('super','campaign_manager','finance','support')),
  granted_by uuid,
  granted_at timestamptz not null default now(),
  unique (org_id, user_id, role)
);
create index if not exists idx_admin_roles_user
  on admin_roles (user_id, org_id);

alter table admin_roles enable row level security;
drop policy if exists admin_roles_service_only on admin_roles;
create policy admin_roles_service_only on admin_roles for select using (false);

comment on table admin_roles is
  'G-D150 관리자 세부 역할 (super/campaign_manager/finance/support). 한 admin이 여러 역할 보유 가능';
