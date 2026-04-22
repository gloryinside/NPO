-- Phase Theme-A: members.theme_preference 컬럼 추가
-- donor 본인이 선호하는 테마를 기기 간 동기화. NULL 대신 default 'system'으로
-- OS prefers-color-scheme 따름을 명시.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS theme_preference text
    CHECK (theme_preference IN ('light','dark','system'))
    DEFAULT 'system';

COMMENT ON COLUMN members.theme_preference IS
  '후원자 선호 테마. system=OS prefers-color-scheme 따름(기본). light/dark=명시 선택.';
