-- 기관 랜딩페이지 게시 이력 (JobYLW 포털 빌더의 portal_publish_history 패턴 이식)
--   게시할 때마다 published_content 스냅샷을 append-only로 쌓는다.
--   되돌리기는 스냅샷을 초안(page_content)으로 복원 → 관리자가 확인 후 다시 게시.
--   (게시본만 몰래 바꾸는 롤백은 초안과 어긋나 다음 게시 때 되살아나므로 쓰지 않는다)
--   서비스 롤(API)만 접근 — campaign_versions와 동일.

create table if not exists org_landing_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  content jsonb not null,
  section_count int not null default 0,
  published_by uuid,
  published_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_landing_history_org
  on org_landing_history (org_id, created_at desc);

alter table org_landing_history enable row level security;
drop policy if exists org_landing_history_service_only on org_landing_history;
create policy org_landing_history_service_only on org_landing_history for select using (false);

comment on table org_landing_history is
  '기관 랜딩페이지 게시 스냅샷(append-only). 복원은 초안으로만.';
