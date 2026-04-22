-- Phase 5-B: 후원자 초대/공유 프로그램.
--
-- 설계:
--   - referral_codes: 각 회원의 공유용 고유 코드 (org 단위 unique)
--   - members.referrer_id: 신규 회원이 누구의 추천으로 가입했는지 추적
--
-- 제약:
--   - 코드는 회원당 1개 (대소문자 구분 없음 → lower()로 저장)
--   - 코드는 orgId가 달라도 전역 unique: 외부 공유 시 "기관이 다른데 같은 코드" 혼란 방지
--   - referrer_id는 같은 org의 다른 member만 가리킬 수 있음 (트리거 아닌 app 레벨 검증)

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT referral_codes_code_lower_check CHECK (code = lower(code)),
  CONSTRAINT referral_codes_code_length CHECK (length(code) BETWEEN 6 AND 16)
);

-- 전역 unique (대소문자 무시 이미 lower 제약으로 보장)
CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(code);

-- 회원당 1개만
CREATE UNIQUE INDEX idx_referral_codes_member ON referral_codes(member_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- 같은 org의 admin만 조회
CREATE POLICY referral_codes_admin_read
  ON referral_codes FOR SELECT
  USING (org_id IN (SELECT org_id FROM admin_users WHERE supabase_uid = auth.uid()));

COMMENT ON TABLE referral_codes IS '후원자 초대용 공유 코드 (member당 1개)';

-- members에 referrer_id 추가
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_referrer ON members(referrer_id) WHERE referrer_id IS NOT NULL;

COMMENT ON COLUMN members.referrer_id IS '이 회원을 초대한 추천인 member_id (선택)';
