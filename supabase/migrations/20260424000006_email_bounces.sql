-- G-D132: 이메일 bounce / complaint 기록
--   provider 가 Resend/SES 무관하게 통일된 스키마.
--   - recipient_email: 정규화된 수신자 이메일
--   - bounce_type: hard | soft | complaint | delivery_delay
--   - provider/provider_event_id 로 중복 처리 방지
--   - 'hard' 또는 'complaint' 누적 시 email_disabled 로 회원 이메일 수신 중단 처리(운영에서 판단)

create table if not exists email_bounces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id) on delete cascade,
  recipient_email text not null,
  bounce_type text not null check (bounce_type in ('hard','soft','complaint','delivery_delay')),
  provider text not null default 'resend',
  provider_event_id text,
  reason text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists idx_email_bounces_recipient
  on email_bounces (recipient_email, created_at desc);
create index if not exists idx_email_bounces_type
  on email_bounces (bounce_type, created_at desc);

alter table email_bounces enable row level security;

-- members 에 이메일 수신 중단 플래그
alter table members add column if not exists email_disabled boolean not null default false;
alter table members add column if not exists email_disabled_reason text;

comment on table email_bounces is
  'G-D132 이메일 bounce/complaint 이벤트 로그. 운영에서 members.email_disabled 결정에 사용';
