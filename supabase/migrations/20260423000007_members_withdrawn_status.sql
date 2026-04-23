-- G-D02: 후원자 본인 계정 삭제(Soft-delete) 지원
--  - status 에 'withdrawn' 추가
--  - deleted_at 타임스탬프 추가

alter table members drop constraint if exists members_status_check;
alter table members add constraint members_status_check
  check (status = any (array['active'::text, 'inactive'::text, 'deceased'::text, 'withdrawn'::text]));

alter table members add column if not exists deleted_at timestamptz;

create index if not exists idx_members_deleted_at
  on members (deleted_at) where deleted_at is not null;

comment on column members.deleted_at is
  'G-D02 후원자 본인이 계정 삭제를 요청한 시점. NULL이면 활성. status=withdrawn 과 짝으로 사용.';
