-- 후원자 만족도/NPS 설문
--   surveys: 설문 정의 (org별, 기간별)
--   survey_responses: 응답 (회원당 1건 — UNIQUE)
--   NPS는 0~10 점수 → promoter/passive/detractor 자동 분류

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null,
  description text,
  -- nps: 0~10 점수 + 선택적 코멘트
  -- csat: 1~5 점수 + 코멘트
  -- custom: 자유 형식 (questions JSONB)
  survey_type text not null default 'nps' check (survey_type in ('nps','csat','custom')),
  questions jsonb,                     -- custom 일 때 [{key,label,type,options?}] 형식
  open_at timestamptz not null default now(),
  close_at timestamptz,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_surveys_org_status on surveys (org_id, status, open_at desc);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  survey_id uuid not null references surveys(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  -- nps/csat 점수 (해당 시)
  score integer,                       -- nps 0~10 / csat 1~5
  -- nps 자동 분류 (저장 시 트리거 또는 응용 단에서 계산)
  nps_category text check (nps_category in ('promoter','passive','detractor')),
  comment text,
  -- custom 응답
  answers jsonb,
  responded_at timestamptz not null default now(),
  unique (survey_id, member_id)
);

create index if not exists idx_survey_responses_survey
  on survey_responses (survey_id, responded_at desc);
create index if not exists idx_survey_responses_member
  on survey_responses (member_id);

alter table surveys enable row level security;
alter table survey_responses enable row level security;

-- RLS
drop policy if exists "surveys_admin_all" on surveys;
create policy "surveys_admin_all" on surveys
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "surveys_open_read" on surveys;
create policy "surveys_open_read" on surveys
  for select using (status = 'open');

drop policy if exists "survey_responses_admin_all" on survey_responses;
create policy "survey_responses_admin_all" on survey_responses
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "survey_responses_self_rw" on survey_responses;
create policy "survey_responses_self_rw" on survey_responses
  for all using (
    member_id in (select id from members where supabase_uid = auth.uid())
  ) with check (
    member_id in (select id from members where supabase_uid = auth.uid())
  );

comment on table surveys is
  '후원자 만족도/NPS 설문. survey_type 별 응답 형식 다름.';
comment on column survey_responses.nps_category is
  'NPS 점수 분류: 0-6=detractor, 7-8=passive, 9-10=promoter (응답 INSERT 시 응용 단에서 계산)';
