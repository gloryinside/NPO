-- SP-5: members.mfa_enabled — UI 표시용 캐시 컬럼
-- 실제 MFA 상태는 Supabase Auth(auth.mfa_factors)가 관리.
-- 이 컬럼은 UI에서 Auth API 왕복 없이 MFA 활성 여부를 빠르게 확인하기 위한 캐시.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN members.mfa_enabled IS
  'SP-5: UI 표시용 MFA 활성 여부 캐시. 권위 있는 상태는 Supabase Auth의 factors가 관리.';
