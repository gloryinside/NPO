-- Tier 12: 도너 가시성, 법인 기부, 정기 금액 변경 대기, 증언, 추천 감사 + reward.

-- G-D197: 후원자 공개/비공개 (랜딩·캠페인 최근 기부자 노출 여부)
alter table members
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));

comment on column members.visibility is
  'G-D197 공개/비공개. private 이면 recent-donors, 캠페인 후원자 피드 등에서 익명 처리';

-- G-D196: 법인·단체 기부자
create table if not exists corporate_donors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  legal_name text not null,
  business_number text,
  representative text,
  contact_email text,
  contact_phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_corporate_donors_org on corporate_donors (org_id);
create index if not exists idx_corporate_donors_member on corporate_donors (member_id)
  where member_id is not null;
alter table corporate_donors enable row level security;
drop policy if exists corporate_donors_service_only on corporate_donors;
create policy corporate_donors_service_only on corporate_donors for select using (false);

-- G-D194: 정기후원 금액 변경 대기 (7일 후 자동 적용 + 사전 안내)
create table if not exists promise_changes_pending (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  promise_id uuid not null references promises(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  new_amount bigint not null check (new_amount > 0),
  reason text,
  requested_at timestamptz not null default now(),
  effective_at timestamptz not null,
  confirmed boolean not null default false,
  applied_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);
create index if not exists idx_promise_changes_effective
  on promise_changes_pending (effective_at)
  where applied_at is null and cancelled_at is null;
alter table promise_changes_pending enable row level security;
drop policy if exists promise_changes_service_only on promise_changes_pending;
create policy promise_changes_service_only on promise_changes_pending for select using (false);

-- G-D202: 후원자 공개 testimonial
create table if not exists donor_testimonials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  content text not null,
  anonymous boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejected_reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_donor_testimonials_campaign
  on donor_testimonials (campaign_id, status, created_at desc);
alter table donor_testimonials enable row level security;
drop policy if exists testimonials_public_read on donor_testimonials;
create policy testimonials_public_read on donor_testimonials for select
  using (status = 'approved');

-- G-D193: 추천 리워드 기록 (현재는 단순 집계용 placeholder — 추후 보상 정책 연결)
create table if not exists referral_rewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  referrer_member_id uuid not null references members(id) on delete cascade,
  referred_member_id uuid not null references members(id) on delete cascade,
  reward_type text not null default 'thank_you_email',
  note text,
  created_at timestamptz not null default now(),
  unique (referrer_member_id, referred_member_id)
);
create index if not exists idx_referral_rewards_referrer
  on referral_rewards (referrer_member_id, created_at desc);
alter table referral_rewards enable row level security;
drop policy if exists referral_rewards_service_only on referral_rewards;
create policy referral_rewards_service_only on referral_rewards for select using (false);
