-- ERP 아웃바운드 웹훅 큐 (재시도 + DLQ)
--   confirm.ts 등에서 push할 이벤트를 큐에 적재 → cron이 발송.
--   실패 시 exponential backoff 재시도, 5회 초과면 dead_letter.

create table if not exists erp_outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- 이벤트 종류
  event_type text not null,
  --   payment.paid, payment.failed, payment.refunded,
  --   promise.created, promise.cancelled, promise.suspended, promise.resumed,
  --   member.created, member.updated, receipt.issued
  payload jsonb not null,
  -- 발송 대상 URL (큐 적재 시점의 org_secrets.erp_webhook_url 스냅샷)
  target_url text not null,
  -- 시그니처 (HMAC-SHA256 of payload)
  signature text,
  -- 상태
  status text not null default 'pending'
    check (status in ('pending','sent','failed','dead_letter')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  last_response_status integer,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_erp_outbound_pending
  on erp_outbound_webhooks (status, next_attempt_at)
  where status = 'pending';
create index if not exists idx_erp_outbound_org
  on erp_outbound_webhooks (org_id, created_at desc);
create index if not exists idx_erp_outbound_dlq
  on erp_outbound_webhooks (org_id, created_at desc)
  where status = 'dead_letter';

alter table erp_outbound_webhooks enable row level security;
drop policy if exists "erp_outbound_admin_all" on erp_outbound_webhooks;
create policy "erp_outbound_admin_all" on erp_outbound_webhooks
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

comment on table erp_outbound_webhooks is
  'ERP push 웹훅 큐. 실패 시 exponential backoff 재시도, 5회 초과 시 dead_letter.';
