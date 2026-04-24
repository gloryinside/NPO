-- SP-5: OTP JWT 서버 side 무효화를 위한 blocklist
-- OTP 세션은 stateless JWT이므로 로그아웃/강제 만료 시 서버가 무효화 불가.
-- 이 테이블은 revocation 기록을 보관해 getDonorSession에서 조회.
-- jti = SHA256(iat || member_id) 의 앞 16자리 (auth.ts 구현 참고).

CREATE TABLE IF NOT EXISTS otp_session_blocklist (
  jti        text        PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT NOW(),
  reason     text
);

COMMENT ON TABLE otp_session_blocklist IS
  'SP-5: OTP JWT revocation 기록. jti는 auth.ts의 makeOtpJti() 결과와 일치.';

-- 7일 이상 지난 항목은 정리 가능 — JWT TTL이 더 짧으므로 blocklist에 남아있을 필요 없음.
-- pg_cron이 활성화된 환경에서 다음을 실행:
--   SELECT cron.schedule('cleanup-otp-blocklist', '0 3 * * *',
--     $$DELETE FROM otp_session_blocklist WHERE revoked_at < NOW() - INTERVAL '7 days'$$);
