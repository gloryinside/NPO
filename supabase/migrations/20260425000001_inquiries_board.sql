-- G-Support: 문의(Inquiry) + 게시판(board_posts) 시스템
--
-- 설계 원칙:
--   1. inquiries      — 후원자↔관리자 1:1 문의·답변
--   2. board_posts    — 공지사항(notice) / FAQ 단방향 게시판 (관리자 작성)
--
-- 멀티테넌트: 모든 테이블에 org_id 포함, RLS로 테넌트 격리
-- 후원자 본인 문의만 열람 가능, 관리자는 자기 org 전체 열람

-- ─── inquiries ──────────────────────────────────────────────────────────────

create table if not exists inquiries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  category     text not null default 'general',  -- general | payment | receipt | donation | other
  subject      text not null,
  body         text not null,
  status       text not null default 'open',     -- open | answered | closed
  answered_at  timestamptz,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 관리자 답변 (1:N — 히스토리 보존, 재답변 가능)
create table if not exists inquiry_replies (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references inquiries(id) on delete cascade,
  org_id       uuid not null references orgs(id) on delete cascade,
  author_role  text not null,  -- admin | member
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_inquiries_org_member on inquiries(org_id, member_id);
create index if not exists idx_inquiries_org_status  on inquiries(org_id, status);
create index if not exists idx_inquiry_replies_inquiry on inquiry_replies(inquiry_id);

alter table inquiries       enable row level security;
alter table inquiry_replies enable row level security;

-- RLS: 서비스 롤만 접근 (API 레이어에서 org_id 필터 강제)
drop policy if exists inquiries_service_only       on inquiries;
drop policy if exists inquiry_replies_service_only on inquiry_replies;

create policy inquiries_service_only on inquiries
  for all using (auth.role() = 'service_role');

create policy inquiry_replies_service_only on inquiry_replies
  for all using (auth.role() = 'service_role');

-- ─── board_posts ─────────────────────────────────────────────────────────────

create table if not exists board_posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  post_type    text not null,  -- notice | faq
  category     text,           -- FAQ 분류: payment | receipt | donation | account | other
  title        text not null,
  body         text not null,
  pinned       boolean not null default false,
  published    boolean not null default false,
  published_at timestamptz,
  created_by   uuid references admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_board_posts_org_type    on board_posts(org_id, post_type);
create index if not exists idx_board_posts_org_pinned  on board_posts(org_id, pinned, published_at desc);

alter table board_posts enable row level security;

drop policy if exists board_posts_service_only on board_posts;
create policy board_posts_service_only on board_posts
  for all using (auth.role() = 'service_role');
