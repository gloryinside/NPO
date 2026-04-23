-- G-D198: admin 개인별 대시보드 레이아웃 JSONB.
--   widget_config 예시:
--     { "order": ["kpi", "recent_payments", "churn_risk"], "hidden": ["cheer_stream"] }

create table if not exists admin_dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,
  widget_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_admin_dashboard_layouts_user
  on admin_dashboard_layouts (user_id);

alter table admin_dashboard_layouts enable row level security;
drop policy if exists admin_dashboard_layouts_service_only on admin_dashboard_layouts;
create policy admin_dashboard_layouts_service_only on admin_dashboard_layouts for select using (false);

comment on table admin_dashboard_layouts is
  'G-D198 admin 개인별 대시보드 위젯 순서·가시성';
