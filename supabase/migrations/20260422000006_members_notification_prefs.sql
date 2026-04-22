-- Phase 7-A / G-115: 후원자 알림 수신 설정.
--
-- JSONB 단일 컬럼으로 여러 알림 종류를 담는다. 키가 없으면 기본값(opt-in)으로 간주.
-- 현재 정의된 키:
--   amount_change: boolean (default true)  — 업/다운 감사 이메일
--
-- 나중에 키가 늘어나도 마이그레이션 없이 확장 가능. CHECK 제약은 두지 않는다 —
-- 필드 유효성은 lib에서 방어.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN members.notification_prefs IS
  'Phase 7-A: 후원자 알림 수신 설정. 예: { "amount_change": false }. 키 생략 = opt-in.';
