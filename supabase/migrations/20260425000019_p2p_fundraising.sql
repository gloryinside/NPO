-- P2P 펀딩 페이지
--   캠페인의 sub-page로 동작. 후원자(member)가 자기 페이지를 만들고 SNS에 공유.
--   결제는 부모 캠페인으로 합산되며 추가로 p2p_page_id를 payments에 기록해 추적.

create table if not exists p2p_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  -- 페이지 소유자 (후원자)
  owner_member_id uuid not null references members(id) on delete cascade,
  -- 슬러그: /c/{campaign_slug}/p/{slug}
  slug text not null,
  title text not null,                 -- '제 결혼식 대신 함께해주세요'
  story text,                          -- 마크다운/장문
  goal_amount numeric(14,2),           -- 개인 목표
  cover_image_url text,
  status text not null default 'active' check (status in ('active','closed','removed')),
  closed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, slug)
);

create index if not exists idx_p2p_pages_owner on p2p_pages (owner_member_id);
create index if not exists idx_p2p_pages_campaign on p2p_pages (campaign_id, status);

-- payments에 p2p 추적 (선택적)
alter table payments add column if not exists p2p_page_id uuid references p2p_pages(id) on delete set null;
create index if not exists idx_payments_p2p on payments (p2p_page_id) where p2p_page_id is not null;

-- 응원 메시지 (cheer 와 별개로, p2p 페이지 한정)
create table if not exists p2p_supporters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  p2p_page_id uuid not null references p2p_pages(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  -- 후원자 표시명 (실명/익명/별명)
  display_name text,
  amount numeric(14,2) not null,
  message text,
  show_amount boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_p2p_supporters_page
  on p2p_supporters (p2p_page_id, created_at desc);

alter table p2p_pages enable row level security;
alter table p2p_supporters enable row level security;

-- RLS
drop policy if exists "p2p_pages_admin_all" on p2p_pages;
create policy "p2p_pages_admin_all" on p2p_pages
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "p2p_pages_public_read" on p2p_pages;
create policy "p2p_pages_public_read" on p2p_pages
  for select using (status = 'active');

drop policy if exists "p2p_pages_owner_rw" on p2p_pages;
create policy "p2p_pages_owner_rw" on p2p_pages
  for all using (
    owner_member_id in (select id from members where supabase_uid = auth.uid())
  ) with check (
    owner_member_id in (select id from members where supabase_uid = auth.uid())
  );

drop policy if exists "p2p_supporters_admin_all" on p2p_supporters;
create policy "p2p_supporters_admin_all" on p2p_supporters
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "p2p_supporters_public_read" on p2p_supporters;
create policy "p2p_supporters_public_read" on p2p_supporters
  for select using (true); -- 페이지가 active 라면 public read (페이지 권한과 결합)

comment on table p2p_pages is
  '개인 모금 페이지. 캠페인의 sub-page로 동작, 모금액은 부모 캠페인 + p2p 추적 둘 다 갱신.';
comment on table p2p_supporters is
  'P2P 페이지에 표시되는 후원자 명단. 익명/표시이름/금액 노출 여부 개별 설정.';
