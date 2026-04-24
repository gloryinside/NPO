-- 1:1 결연 (Sponsorship) 모듈
--   beneficiaries: 수혜자(아동/노인 등)
--   sponsorships: 후원자(member) ↔ 수혜자(beneficiary) 매칭
--   sponsor_letters: 양방향 편지/소식
--   beneficiary_updates: 수혜자 정기 근황 업데이트

-- 수혜자 마스터
create table if not exists beneficiaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text not null,                  -- 결연 코드 (예: KR-2026-0042)
  name text not null,
  -- 최소 PII (주민번호 안 받음)
  birth_year integer,
  gender text check (gender in ('male','female','other')),
  region text,                         -- '서울 강북' 등 광역
  bio text,
  -- 프로그램 연결 (어느 사업의 수혜자인가)
  program_id uuid references programs(id) on delete set null,
  -- 상태
  status text not null default 'available'
    check (status in ('available','sponsored','graduated','withdrawn')),
  enrolled_at date,
  graduated_at date,
  -- 사진 (대표) — Storage 경로
  photo_url text,
  -- 메타
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists idx_beneficiaries_org_status
  on beneficiaries (org_id, status);

-- 결연 (다대다 — 한 후원자가 여러 명 결연 가능, 한 수혜자가 여러 후원자 가능)
create table if not exists sponsorships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  sponsor_member_id uuid not null references members(id) on delete restrict,
  beneficiary_id uuid not null references beneficiaries(id) on delete restrict,
  promise_id uuid references promises(id) on delete set null, -- 연결된 정기약정
  start_date date not null,
  end_date date,
  monthly_amount numeric(14,2),
  status text not null default 'active'
    check (status in ('active','paused','ended')),
  end_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sponsor_member_id, beneficiary_id, start_date)
);

create index if not exists idx_sponsorships_sponsor on sponsorships (sponsor_member_id, status);
create index if not exists idx_sponsorships_beneficiary on sponsorships (beneficiary_id, status);

-- 양방향 편지/소식
create table if not exists sponsor_letters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  sponsorship_id uuid not null references sponsorships(id) on delete cascade,
  -- 방향
  direction text not null check (direction in ('to_beneficiary','to_sponsor')),
  -- 원본 / 번역본
  original_text text,
  translated_text text,
  attachments jsonb default '[]'::jsonb,
  -- 처리 상태
  status text not null default 'received'
    check (status in ('received','translating','reviewed','delivered','rejected')),
  -- 검수
  reviewed_by uuid,
  reviewed_at timestamptz,
  delivered_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsor_letters_sponsorship_status
  on sponsor_letters (sponsorship_id, status, created_at desc);

-- 수혜자 정기 근황 업데이트 (해당 수혜자를 결연한 모든 후원자에게 공유)
create table if not exists beneficiary_updates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  update_date date not null default current_date,
  title text,
  body text,
  photo_urls jsonb default '[]'::jsonb,
  -- 공개 범위
  visibility text not null default 'sponsors_only'
    check (visibility in ('sponsors_only','public')),
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_beneficiary_updates_beneficiary
  on beneficiary_updates (beneficiary_id, update_date desc);

alter table beneficiaries enable row level security;
alter table sponsorships enable row level security;
alter table sponsor_letters enable row level security;
alter table beneficiary_updates enable row level security;

comment on table beneficiaries is
  '결연 수혜자 마스터. 최소 PII만 보유 (주민번호 X, 생년/지역만).';
comment on table sponsorships is
  '후원자-수혜자 결연. 다대다 매칭 가능, promise_id로 정기약정 연결.';
comment on table sponsor_letters is
  '양방향 편지. translated_text는 어드민이 번역/검수 후 reviewed→delivered.';
