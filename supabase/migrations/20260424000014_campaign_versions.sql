-- G-D154/D155: campaign 자동 저장 + 버전 이력
--   campaign_versions: campaign 편집 시마다 snapshot (page_content/form_settings/title)
--   created_by: admin user_id
--   restore 는 별도 API 에서 수행

create table if not exists campaign_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text,
  page_content jsonb,
  form_settings jsonb,
  created_by uuid,
  created_by_email text,
  label text,              -- 'manual' | 'autosave' | 'publish'
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_versions_campaign
  on campaign_versions (campaign_id, created_at desc);

-- autosave 정리용 — 동일 campaign 에서 autosave 누적 시 최근 10개만 유지 (트리거 또는 cron 에서 처리)

alter table campaign_versions enable row level security;
drop policy if exists campaign_versions_service_only on campaign_versions;
create policy campaign_versions_service_only on campaign_versions for select using (false);

comment on table campaign_versions is
  'G-D154/D155 캠페인 snapshot. label: manual/autosave/publish';
