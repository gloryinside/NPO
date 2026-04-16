-- 기관 계좌 정보 (계좌이체 후원 안내용)
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS bank_name       text,
  ADD COLUMN IF NOT EXISTS bank_account    text,
  ADD COLUMN IF NOT EXISTS account_holder  text;

COMMENT ON COLUMN orgs.bank_name      IS '은행명 (예: 국민은행)';
COMMENT ON COLUMN orgs.bank_account   IS '계좌번호';
COMMENT ON COLUMN orgs.account_holder IS '예금주';
