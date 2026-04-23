-- G-D96: 마이그레이션 적용 불일치 복구
--   로컬 파일에 있지만 원격(supabase_migrations.schema_migrations)에 등록되지 않은
--   테이블/컬럼이 다수 발견됨. 안전하게 재적용하기 위해 idempotent(if not exists)로 선언.
--
--   포함 대상:
--     - members.notification_prefs (JSONB)
--     - members.referrer_id (FK self)
--     - otp_codes
--     - referral_codes + RLS
--     - promise_amount_changes
--     - cheer_messages
--     - admin_notifications
--     - notification_log
--
--   이 마이그레이션은 이미 DB에 반영됐으며, 파일 형태로 버전 관리에 편입시키는 목적.

alter table members add column if not exists notification_prefs jsonb default '{}'::jsonb;
alter table members add column if not exists referrer_id uuid references members(id) on delete set null;
create index if not exists idx_members_referrer on members (referrer_id) where referrer_id is not null;

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  phone text not null,
  code text not null,
  attempts integer not null default 0,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_otp_codes_lookup on otp_codes (phone, org_id, created_at desc);
alter table otp_codes enable row level security;

create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  unique (member_id)
);
create index if not exists idx_referral_codes_org on referral_codes (org_id);
alter table referral_codes enable row level security;
drop policy if exists referral_self on referral_codes;
create policy referral_self on referral_codes for select
  using (exists (select 1 from members m where m.id = referral_codes.member_id and m.supabase_uid = auth.uid()));

create table if not exists promise_amount_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  promise_id uuid not null references promises(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  previous_amount bigint not null,
  new_amount bigint not null,
  direction text not null check (direction in ('up','down','same')),
  actor text not null check (actor in ('member','admin','system')),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_promise_amount_changes_promise on promise_amount_changes (promise_id, created_at desc);
alter table promise_amount_changes enable row level security;

create table if not exists cheer_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  body text not null,
  anonymous boolean not null default false,
  published boolean not null default true,
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cheer_campaign_created
  on cheer_messages (campaign_id, created_at desc)
  where hidden = false and published = true;
create index if not exists idx_cheer_member
  on cheer_messages (member_id, created_at desc);
alter table cheer_messages enable row level security;
drop policy if exists cheer_public_read on cheer_messages;
create policy cheer_public_read on cheer_messages for select
  using (hidden = false and published = true);
drop policy if exists cheer_self_read on cheer_messages;
create policy cheer_self_read on cheer_messages for select
  using (exists (select 1 from members m where m.id = cheer_messages.member_id and m.supabase_uid = auth.uid()));

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_notifications_org_unread on admin_notifications (org_id, read, created_at desc);
alter table admin_notifications enable row level security;

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  recipient text not null,
  template text not null,
  ref_key text,
  sent_at timestamptz not null default now()
);
create index if not exists idx_notification_log_ref on notification_log (recipient, template, ref_key, sent_at desc);
alter table notification_log enable row level security;

comment on table otp_codes is 'G-D96 복구: 기존 마이그레이션이 원격에 미적용돼 재선언';
