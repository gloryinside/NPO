-- G-D127: 후원자 lifecycle 단계
--   단계 정의:
--     - new:     가입 <= 30일, 결제 이력 0~1건
--     - active:  최근 3개월 내 paid 결제 1건 이상
--     - dormant: 최근 3~12개월 paid 없음
--     - churned: 최근 12개월 이상 paid 없음 + active 약정 없음
--     - vip:     관리자 수동 지정 (대표 기부자)
--
-- 분류는 cron job (별도 구현) 이 일 1회 계산하여 갱신.
-- 수동 override 가능 (lifecycle_manual=true 이면 cron이 건드리지 않음).

alter table members
  add column if not exists lifecycle_stage text
    check (
      lifecycle_stage is null or
      lifecycle_stage in ('new', 'active', 'dormant', 'churned', 'vip')
    ),
  add column if not exists lifecycle_stage_updated_at timestamptz,
  add column if not exists lifecycle_manual boolean not null default false;

create index if not exists idx_members_lifecycle_stage
  on members (org_id, lifecycle_stage, lifecycle_stage_updated_at desc)
  where deleted_at is null;

comment on column members.lifecycle_stage is
  'G-D127 후원자 lifecycle (new/active/dormant/churned/vip). NULL은 미분류';
comment on column members.lifecycle_manual is
  'G-D127 true이면 cron이 자동 분류를 덮어쓰지 않음';
