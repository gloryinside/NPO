ALTER TABLE promises ADD COLUMN IF NOT EXISTS customer_key TEXT;
COMMENT ON COLUMN promises.customer_key IS 'Toss 빌링 customerKey (자동결제용)';
