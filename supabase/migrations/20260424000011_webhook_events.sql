-- G-D186: 수신된 webhook 의 처리 상태를 보관하여 재시도·DLQ 에 사용.
--   provider: 'toss' | 'resend'
--   processed_at 이 NULL 이면 재시도 대상.
--   fail_count 5 초과는 dead_letter=true 로 플래그.

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  payload jsonb not null,
  signature text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  fail_count integer not null default 0,
  dead_letter boolean not null default false
);

create index if not exists idx_webhook_events_pending
  on webhook_events (provider, received_at)
  where processed_at is null and dead_letter = false;
create index if not exists idx_webhook_events_dlq
  on webhook_events (provider, received_at)
  where dead_letter = true;

alter table webhook_events enable row level security;
drop policy if exists webhook_events_service_only on webhook_events;
create policy webhook_events_service_only on webhook_events for select using (false);

comment on table webhook_events is
  'G-D186 수신 webhook 이벤트 원본. processed_at NULL 이면 cron 이 재시도';
