-- 현장 모금(태블릿) — 거리·행사장에서 모금가가 태블릿으로 정기후원 신청을 받는다.
--   f2f_agents          : 모금가별 신청 링크. 토큰 원문은 만들 때 한 번만 보여 주고 해시만 저장한다.
--   payments/promises.f2f_agent_id : 어느 모금가가 받은 신청인지(실적·수수료 정산용)
--   consent-evidence 버킷 : 태블릿에서 받은 자동이체 출금동의 서명 이미지(비공개, 서버만 접근)

create table if not exists f2f_agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  code text not null check (code ~ '^[A-Za-z0-9_-]{2,20}$'),
  token_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);
create index if not exists idx_f2f_agents_org on f2f_agents (org_id, active);
alter table f2f_agents enable row level security;
drop policy if exists f2f_agents_admin_only on f2f_agents;
create policy f2f_agents_admin_only on f2f_agents for select using (false);

alter table payments add column if not exists f2f_agent_id uuid references f2f_agents(id) on delete set null;
alter table promises add column if not exists f2f_agent_id uuid references f2f_agents(id) on delete set null;
create index if not exists idx_promises_f2f_agent on promises (f2f_agent_id) where f2f_agent_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consent-evidence', 'consent-evidence', false, 524288, array['image/png'])
on conflict (id) do nothing;

drop policy if exists "service_role_all_consent_evidence" on storage.objects;
create policy "service_role_all_consent_evidence"
  on storage.objects for all
  using (bucket_id = 'consent-evidence' and auth.role() = 'service_role')
  with check (bucket_id = 'consent-evidence' and auth.role() = 'service_role');

comment on table f2f_agents is '현장 모금가 신청 링크 — token_hash 만 저장(sha256)';
