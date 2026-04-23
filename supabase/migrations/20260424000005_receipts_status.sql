-- G-D131: 영수증 재발행 시 기존 영수증 상태 명시
--   status:
--     - issued: 정상 발급
--     - reissued_from: 이 영수증을 근거로 신규본 발급 (기존은 무효)
--     - cancelled: 취소 (환불 등)
--   superseded_by: 신규 영수증 id (reissue 시 자동 연결)

alter table receipts
  add column if not exists status text default 'issued'
    check (status in ('issued', 'reissued_from', 'cancelled')),
  add column if not exists superseded_by uuid references receipts(id) on delete set null,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_at timestamptz;

create index if not exists idx_receipts_superseded_by
  on receipts (superseded_by) where superseded_by is not null;

comment on column receipts.status is
  'G-D131 영수증 상태. reissue 시 원본은 reissued_from 으로 전환';
comment on column receipts.superseded_by is
  'G-D131 신규 영수증 id (재발행 시 연결)';
