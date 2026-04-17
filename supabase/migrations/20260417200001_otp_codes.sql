-- OTP 인증 코드 저장
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone_org ON otp_codes(phone, org_id);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);

-- RLS: service-role only
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE otp_codes IS 'SMS OTP 인증 코드. 5분 TTL, rate limit 관리용.';
