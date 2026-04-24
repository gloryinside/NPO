-- 물품기부 (in-kind donation)
--   현금 외 물품을 기부받고 공정시장가액(FMV)으로 평가하는 워크플로.
--   pending(접수) → appraised(평가완료) → accepted(수락/영수증발급) | rejected(반려)

create table if not exists in_kind_donations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  -- 회원이 아닌 비회원 기부도 받을 수 있도록 자유 텍스트 유지
  donor_name text,
  donor_phone text,
  donor_email text,
  -- 물품 정보
  item_name text not null,
  category text,
  quantity integer not null default 1 check (quantity > 0),
  description text,
  estimated_value numeric(14,2),     -- 후원자가 신고한 추정가액
  appraised_value numeric(14,2),     -- 어드민이 평가한 공정시장가액
  appraised_by uuid,
  appraised_at timestamptz,
  -- 상태
  status text not null default 'pending'
    check (status in ('pending','appraised','accepted','rejected')),
  rejected_reason text,
  -- 수령
  received_at date,
  received_location text,
  -- 영수증 연결 (선택 — 적격기부 영수증 발급 시)
  receipt_id uuid,
  -- 첨부 (사진 등)
  photo_urls jsonb default '[]'::jsonb,
  -- 메타
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inkind_org_status
  on in_kind_donations (org_id, status, created_at desc);
create index if not exists idx_inkind_member
  on in_kind_donations (member_id) where member_id is not null;

alter table in_kind_donations enable row level security;

comment on table in_kind_donations is
  '물품기부 접수/평가/수락 워크플로. 현금이 아닌 in-kind 후원을 추적.';
comment on column in_kind_donations.appraised_value is
  '어드민 평가 공정시장가액. 영수증 발급 시 이 금액을 사용.';
