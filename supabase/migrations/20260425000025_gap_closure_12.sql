-- GAP 12종 통합 클로저
--   G1 UTM attribution / G2 EFT 청구 / G3 결산 / G4 공시 / G5 회비
--   G6 지출결의 / G7 외부 webhook / G8 카드갱신 / G9 위탁모금
--   G10 중복결제 / G11 PG 수수료 / G12 모바일 푸시

-- ============================================================================
-- G1. UTM Attribution
-- ============================================================================
alter table payments add column if not exists utm_source text;
alter table payments add column if not exists utm_medium text;
alter table payments add column if not exists utm_campaign text;
alter table payments add column if not exists utm_content text;
alter table payments add column if not exists utm_term text;
alter table payments add column if not exists referrer text;
alter table payments add column if not exists landing_url text;

create index if not exists idx_payments_utm_source on payments (org_id, utm_source) where utm_source is not null;
create index if not exists idx_payments_utm_campaign on payments (org_id, utm_campaign) where utm_campaign is not null;

-- members에도 최초 유입 UTM 보존
alter table members add column if not exists first_utm_source text;
alter table members add column if not exists first_utm_medium text;
alter table members add column if not exists first_utm_campaign text;

-- ============================================================================
-- G2. CMS EFT 청구 파일
-- ============================================================================
create table if not exists cms_claim_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  filename text not null,
  file_format text not null default 'kftc' check (file_format in ('kftc','kfb','custom')),
  bank_account_id uuid references bank_accounts(id) on delete set null,
  -- 청구 정보
  claim_date date not null,
  payment_count integer not null default 0,
  total_amount numeric(14,2) not null default 0,
  -- 상태 흐름: draft → submitted → result_received → completed
  status text not null default 'draft'
    check (status in ('draft','submitted','result_received','completed')),
  submitted_at timestamptz,
  result_received_at timestamptz,
  -- 결과 집계
  success_count integer,
  fail_count integer,
  -- 파일 저장 경로 (Storage)
  file_url text,
  result_file_url text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_cms_claim_files_org_date
  on cms_claim_files (org_id, claim_date desc);

-- 파일 라인 (개별 청구 건)
create table if not exists cms_claim_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  claim_file_id uuid not null references cms_claim_files(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  -- 청구 정보
  account_holder text not null,
  bank_code text,
  account_no text,                         -- 마스킹 후 저장
  amount numeric(14,2) not null,
  -- 결과
  result_code text,                        -- '00' 성공, 'XX' 실패코드
  result_message text,
  unique (claim_file_id, payment_id)
);

create index if not exists idx_cms_claim_lines_file
  on cms_claim_lines (claim_file_id);

-- ============================================================================
-- G3. 결산 보고서 (수지/대차)
-- ============================================================================
create table if not exists fiscal_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  fiscal_year integer not null,
  report_type text not null check (report_type in ('income_expense','balance_sheet','cash_flow','custom')),
  period_start date not null,
  period_end date not null,
  -- 집계 데이터 (스냅샷, jsonb)
  data jsonb not null,
  -- 상태
  status text not null default 'draft' check (status in ('draft','final','submitted')),
  notes text,
  generated_at timestamptz not null default now(),
  generated_by uuid
);

create index if not exists idx_fiscal_reports_org_year
  on fiscal_reports (org_id, fiscal_year desc, report_type);

-- ============================================================================
-- G4. 공익법인 공시 (transparency disclosure)
-- ============================================================================
create table if not exists transparency_disclosures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  fiscal_year integer not null,
  -- 공시 항목
  disclosure_type text not null check (disclosure_type in (
    'income_summary',         -- 수입 명세
    'expense_summary',        -- 사용 명세
    'salary_top5',            -- 임직원 보수 상위 5인
    'related_party',          -- 특수관계인 거래
    'fundraising_cost',       -- 모금 비용
    'donor_top5',             -- 1억 이상 후원자
    'other'
  )),
  title text not null,
  content jsonb,                            -- 공시 내용
  pdf_url text,                             -- 첨부 PDF
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_transparency_disclosures_org_year
  on transparency_disclosures (org_id, fiscal_year desc);

-- ============================================================================
-- G5. 회비 (Membership Fees)
-- ============================================================================
create table if not exists membership_fee_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,                      -- '정회원 연회비', '준회원 월회비'
  fee_amount numeric(14,2) not null,
  cycle text not null check (cycle in ('annual','monthly','one_time')),
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- 회원이 어떤 회비 플랜에 가입했는지
alter table members add column if not exists fee_plan_id uuid references membership_fee_plans(id) on delete set null;
alter table members add column if not exists fee_paid_until date;     -- 회비 납부 만료일

-- 회비 납부 이력
create table if not exists membership_fee_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  fee_plan_id uuid not null references membership_fee_plans(id) on delete restrict,
  amount numeric(14,2) not null,
  paid_date date not null,
  period_start date not null,
  period_end date not null,
  -- 일반 후원과 분리하기 위해 별도 테이블 (회계상 분개도 다름)
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mfp_member on membership_fee_payments (member_id, paid_date desc);

-- ============================================================================
-- G6. 지출 결의/품의 (Expense Vouchers with approval workflow)
-- ============================================================================
create table if not exists expense_vouchers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  voucher_no text not null,
  voucher_date date not null,
  program_id uuid references programs(id) on delete set null,
  -- 청구 정보
  total_amount numeric(14,2) not null,
  vendor text,
  description text not null,
  -- 결재 흐름: draft → submitted → reviewed → approved → paid | rejected
  status text not null default 'draft' check (status in (
    'draft','submitted','reviewed','approved','paid','rejected'
  )),
  -- 결재자
  submitted_by uuid,
  submitted_at timestamptz,
  reviewer_id uuid,
  reviewed_at timestamptz,
  approver_id uuid,
  approved_at timestamptz,
  rejected_reason text,
  -- 지급 처리
  paid_at timestamptz,
  bank_account_id uuid references bank_accounts(id) on delete set null,
  -- 첨부
  attachments jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, voucher_no)
);

create index if not exists idx_expense_vouchers_org_status
  on expense_vouchers (org_id, status, voucher_date desc);

-- 라인 (다중 항목)
create table if not exists expense_voucher_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  voucher_id uuid not null references expense_vouchers(id) on delete cascade,
  budget_item_id uuid references program_budget_items(id) on delete set null,
  expense_account_id uuid references chart_of_accounts(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null,
  vat_amount numeric(14,2) default 0,
  withholding_tax_amount numeric(14,2) default 0
);

create index if not exists idx_expense_voucher_lines_voucher
  on expense_voucher_lines (voucher_id);

-- ============================================================================
-- G7. 외부 Webhook 구독 (Slack/Discord/일반)
-- ============================================================================
create table if not exists external_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,                      -- '운영팀 Slack', '회계 알림 채널'
  channel text not null check (channel in ('slack','discord','generic')),
  webhook_url text not null,
  -- 구독 이벤트 (배열)
  event_types text[] not null,             -- ['payment.paid', 'payment.failed', 'churn.high']
  -- 필터 (옵션)
  min_amount numeric(14,2),                -- 이 금액 이상만 알림
  active boolean not null default true,
  -- 통계
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  last_delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ews_org_active on external_webhook_subscriptions (org_id, active);

-- ============================================================================
-- G8. 카드 자동 갱신 알림 — schema 추가 필요 없음, cron만 추가
-- (이미 promises.card_expiry_year/month 있음)
-- ============================================================================

-- ============================================================================
-- G9. 위탁모금 채널 통합 (Naver Happy Bean / Kakao Same Value)
-- ============================================================================
create table if not exists external_donation_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  source text not null check (source in ('naver_happybean','kakao_samevalue','tmoney','other')),
  source_donation_id text,                 -- 외부 시스템 ID
  -- 후원 정보
  donor_name text,
  donor_phone text,
  donor_email text,
  amount numeric(14,2) not null,
  donated_at timestamptz not null,
  campaign_external_id text,
  -- 매칭
  matched_member_id uuid references members(id) on delete set null,
  matched_payment_id uuid references payments(id) on delete set null,
  match_status text not null default 'pending' check (match_status in (
    'pending','auto_matched','manually_matched','no_match','imported'
  )),
  -- 원본
  raw_data jsonb,
  imported_at timestamptz not null default now(),
  unique (source, source_donation_id)
);

create index if not exists idx_edi_org_status
  on external_donation_imports (org_id, match_status, donated_at desc);

-- ============================================================================
-- G10. 중복 결제 감지 — payments에 dedup hash + 알림 트리거
-- ============================================================================
alter table payments add column if not exists dedup_hash text;
create index if not exists idx_payments_dedup
  on payments (org_id, dedup_hash, created_at)
  where dedup_hash is not null;

-- 정산 차이 알림
create table if not exists settlement_discrepancies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  discrepancy_type text not null check (discrepancy_type in (
    'duplicate_payment',                  -- 중복결제 의심
    'amount_mismatch',                    -- 금액 불일치 (PG 보고 vs 우리 기록)
    'missing_settlement',                 -- 정산 누락 (paid인데 입금 없음)
    'unmatched_deposit'                   -- 정체불명 입금
  )),
  related_payment_ids uuid[],
  amount_expected numeric(14,2),
  amount_actual numeric(14,2),
  detected_date date not null,
  status text not null default 'open' check (status in ('open','investigating','resolved','false_positive')),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_settlement_discrepancies_org_status
  on settlement_discrepancies (org_id, status, detected_date desc);

-- ============================================================================
-- G11. PG 수수료 분개 — payments에 fee 컬럼
-- ============================================================================
alter table payments add column if not exists pg_fee_amount numeric(14,2) default 0;
alter table payments add column if not exists pg_fee_account_id uuid references chart_of_accounts(id) on delete set null;
alter table payments add column if not exists net_amount numeric(14,2);  -- 실 입금액 (amount - pg_fee)

-- ============================================================================
-- G12. 모바일 푸시 (FCM/APNs)
-- ============================================================================
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  device_id text not null,                 -- 기기별 고유 ID (앱 내부 생성)
  platform text not null check (platform in ('ios','android','web')),
  token text not null,
  app_version text,
  active boolean not null default true,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (member_id, device_id)
);

create index if not exists idx_push_tokens_member
  on push_tokens (member_id, active) where active = true;

create table if not exists push_dispatches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  -- 발송 정보
  platform text,
  title text not null,
  body text not null,
  data jsonb,
  -- 결과
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent','delivered','clicked','failed')),
  error_message text
);

create index if not exists idx_push_dispatches_member
  on push_dispatches (member_id, sent_at desc) where member_id is not null;

-- ============================================================================
-- RLS
-- ============================================================================
alter table cms_claim_files enable row level security;
alter table cms_claim_lines enable row level security;
alter table fiscal_reports enable row level security;
alter table transparency_disclosures enable row level security;
alter table membership_fee_plans enable row level security;
alter table membership_fee_payments enable row level security;
alter table expense_vouchers enable row level security;
alter table expense_voucher_lines enable row level security;
alter table external_webhook_subscriptions enable row level security;
alter table external_donation_imports enable row level security;
alter table settlement_discrepancies enable row level security;
alter table push_tokens enable row level security;
alter table push_dispatches enable row level security;

-- 패턴: admin_all + 일부 self_read
do $$ declare
  t text;
  tables text[] := array[
    'cms_claim_files','cms_claim_lines','fiscal_reports','transparency_disclosures',
    'membership_fee_plans','membership_fee_payments','expense_vouchers','expense_voucher_lines',
    'external_webhook_subscriptions','external_donation_imports','settlement_discrepancies',
    'push_tokens','push_dispatches'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_admin_all on %I', t, t);
    execute format('create policy %I_admin_all on %I for all using (is_org_admin(org_id)) with check (is_org_admin(org_id))', t, t);
  end loop;
end $$;

-- transparency_disclosures: published 면 익명 read 허용
drop policy if exists transparency_public_read on transparency_disclosures;
create policy transparency_public_read on transparency_disclosures
  for select using (status = 'published');

-- push_tokens: donor 자기 토큰 RW
drop policy if exists push_tokens_self_rw on push_tokens;
create policy push_tokens_self_rw on push_tokens
  for all using (member_id in (select id from members where supabase_uid = auth.uid()))
  with check (member_id in (select id from members where supabase_uid = auth.uid()));

-- membership_fee_plans 익명 read (가입 페이지에서 보여주기 위해)
drop policy if exists mfp_public_read on membership_fee_plans;
create policy mfp_public_read on membership_fee_plans
  for select using (active = true);

comment on table cms_claim_files is
  'CMS EFT 청구 파일. 금결원 표준 또는 자체 포맷으로 생성, submit → result 흐름.';
comment on table fiscal_reports is
  '결산 보고서 — 수지/대차/현금흐름 등 회계 보고서 스냅샷 jsonb로 보존.';
comment on table transparency_disclosures is
  '공익법인 의무공시 — 임직원 보수 / 1억 이상 후원자 / 모금비용 등 법정 공시 항목.';
comment on table expense_vouchers is
  '지출 결의서 (품의서) — submitted → reviewed → approved → paid 결재 흐름. program_expenses와 별개.';
comment on table external_webhook_subscriptions is
  '외부 webhook 구독 (Slack/Discord/일반). 이벤트 발생 시 자동 push.';
comment on table external_donation_imports is
  '네이버해피빈/카카오같이가치 등 외부 모금 채널 후원 import — auto/manual 매칭.';
comment on table settlement_discrepancies is
  '정산 차이 (중복결제/금액불일치/누락/정체불명입금) — 운영 사고 사전 감지.';
comment on table push_tokens is
  '모바일 앱 푸시 토큰 (FCM/APNs). web push는 platform=web.';
