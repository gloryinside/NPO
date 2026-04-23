-- G-D25: 후원자 프로필/보안 관련 감사 로그
-- 이름·연락처·생일·비밀번호 변경, 계정 삭제, 2FA 이벤트 기록

create table if not exists member_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  action text not null,
    -- 'profile_update' | 'password_change' | 'account_delete' | 'email_change_attempt' | '2fa_enroll' | '2fa_unenroll'
  diff jsonb,
    -- { before: {...}, after: {...} } 또는 자유 형식 (민감 정보 마스킹 필수)
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_audit_log_member_time
  on member_audit_log (member_id, created_at desc);

create index if not exists idx_member_audit_log_action
  on member_audit_log (org_id, action, created_at desc);

alter table member_audit_log enable row level security;

-- 본인 로그 열람: member 세션(Supabase uid 매칭)만 SELECT 허용
create policy member_audit_log_self_select on member_audit_log
  for select
  using (
    exists (
      select 1 from members m
      where m.id = member_audit_log.member_id
        and m.supabase_uid = auth.uid()
    )
  );

-- 서버사이드(service_role) insert는 RLS bypass 되므로 별도 정책 불필요.
-- 관리자 열람 정책은 별도 admin migration에서 추가 예정.

comment on table member_audit_log is
  'G-D25 후원자 본인 계정 변경 이력 (프로필/비번/삭제/2FA)';
