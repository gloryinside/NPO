-- Drop plaintext secret columns after encryption backfill
--
-- org_secrets: toss_client_key, toss_secret_key, toss_webhook_secret, erp_api_key 는
-- 20260417000008에서 추가된 *_enc / erp_api_key_hash 컬럼으로 대체됐다.
-- 관리자 설정 페이지에서 재저장(백필) 완료 후 이 마이그레이션을 적용한다.
--
-- members: id_number 평문 컬럼은 20260417000007에서 추가된
-- id_number_encrypted 로 대체됐다. 실 사용 데이터 없음을 확인 후 적용.

ALTER TABLE org_secrets
  DROP COLUMN IF EXISTS toss_client_key,
  DROP COLUMN IF EXISTS toss_secret_key,
  DROP COLUMN IF EXISTS toss_webhook_secret,
  DROP COLUMN IF EXISTS erp_api_key;

ALTER TABLE members
  DROP COLUMN IF EXISTS id_number;
