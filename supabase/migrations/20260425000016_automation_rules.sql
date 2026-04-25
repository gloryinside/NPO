-- 자동화 룰 엔진
--   trigger_type: 어떤 이벤트가 룰을 깨우는가
--   conditions: JSONB — [{field, op, value}, ...]
--   actions: JSONB — [{type, params}, ...]
--   evaluator: 즉시 (payment.paid 등) + cron (시간기반)

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  -- 트리거: payment_paid, payment_failed, promise_created, promise_cancelled,
  --        member_inactive_days (cron), cumulative_milestone (cron), birthday (cron)
  trigger_type text not null,
  -- 조건: AND 결합
  --   [{ field: 'amount', op: 'gte', value: 100000 },
  --    { field: 'tier',   op: 'in',  value: ['gold','platinum'] }]
  conditions jsonb default '[]'::jsonb,
  -- 액션: 순차 실행 (best-effort, 실패해도 다음 액션 진행)
  --   [{ type: 'send_email', params: { templateScenario: 'donation_thanks' } },
  --    { type: 'send_alimtalk', params: { templateCode: '...' } },
  --    { type: 'admin_notify', params: { message: '...' } },
  --    { type: 'add_tag', params: { tagId: '...' } }]
  actions jsonb default '[]'::jsonb,
  active boolean not null default true,
  -- 동일 (rule, target) 짧은 시간 내 재실행 방지
  cooldown_minutes integer not null default 60,
  last_run_at timestamptz,
  run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_org_trigger
  on automation_rules (org_id, trigger_type, active);

-- 실행 이력 (debounce + 감사 추적)
create table if not exists automation_rule_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  -- 대상: 이벤트의 주된 엔티티 (payment_id, member_id, promise_id 등)
  target_type text,
  target_id uuid,
  status text not null check (status in ('success','partial','failed','skipped')),
  actions_executed integer default 0,
  actions_failed integer default 0,
  error_summary text,
  trigger_payload jsonb,
  ran_at timestamptz not null default now()
);

create index if not exists idx_automation_rule_runs_rule
  on automation_rule_runs (rule_id, ran_at desc);
create index if not exists idx_automation_rule_runs_target
  on automation_rule_runs (target_type, target_id, ran_at desc);

alter table automation_rules enable row level security;
alter table automation_rule_runs enable row level security;

drop policy if exists "automation_rules_admin_all" on automation_rules;
create policy "automation_rules_admin_all" on automation_rules
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "automation_rule_runs_admin_all" on automation_rule_runs;
create policy "automation_rule_runs_admin_all" on automation_rule_runs
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

comment on table automation_rules is
  '자동화 룰: 트리거 이벤트 → 조건 평가 → 액션 실행. cooldown_minutes로 중복 실행 방지.';
comment on table automation_rule_runs is
  '룰 실행 이력. debounce 검사 + 감사 추적.';
