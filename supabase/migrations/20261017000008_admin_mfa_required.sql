-- 관리자 2단계 인증(OTP 앱) — 기관이 켜면 모든 관리자가 등록해야 관리자 화면을 쓸 수 있다.
-- 기본은 꺼짐(배포 즉시 잠기지 않게). 꺼져 있어도 스스로 등록한 관리자는 로그인 때 2단계를 거친다.
alter table orgs
  add column if not exists admin_mfa_required boolean not null default false;

comment on column orgs.admin_mfa_required is
  '관리자 2단계 인증 필수 여부 — lib/auth/admin-mfa';
