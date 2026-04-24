-- email_bounces 처리 워크플로 컬럼 추가
--   admin 이 반송 건을 "처리 완료"로 표시하고, 회원 이메일을 다시 활성화할 수 있도록.
--   resolved_at IS NULL 이 미처리 상태(어드민 대시보드 "이메일 반송 미처리" 카운트의 기준).

alter table email_bounces add column if not exists resolved_at timestamptz;
alter table email_bounces add column if not exists resolved_by uuid;
alter table email_bounces add column if not exists resolved_note text;

create index if not exists idx_email_bounces_unresolved
  on email_bounces (org_id, created_at desc)
  where resolved_at is null;

comment on column email_bounces.resolved_at is
  '어드민이 반송 건을 처리 완료로 표시한 시각. NULL = 미처리.';
comment on column email_bounces.resolved_by is
  '처리한 어드민 user id (auth.users.id 참조).';
comment on column email_bounces.resolved_note is
  '처리 메모 (예: 회원에게 이메일 변경 요청 완료 등).';
