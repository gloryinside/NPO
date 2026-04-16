-- Phase 3 GAP: org_secrets에 ERP webhook URL 추가, members에 주민번호(암호화) 필드 추가

-- ERP Webhook Push URL (Phase 3: 실시간 Push 연동)
ALTER TABLE org_secrets
  ADD COLUMN IF NOT EXISTS erp_webhook_url text;

-- 기부금 영수증 발급을 위한 주민등록번호 (암호화 저장 전제)
-- NULL 허용: 입력 전까지 영수증 미발급 처리
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS id_number text;      -- AES-256 암호화 저장 예정 (application-level)

-- id_number 컬럼 주석
COMMENT ON COLUMN members.id_number IS '주민등록번호 (AES-256 암호화 저장). 기부금영수증 발급 및 국세청 간소화 전산파일 생성에 사용.';

-- receipts 테이블에 국세청 간소화 파일 생성 여부 기록 컬럼 추가
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS nts_submitted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN receipts.nts_submitted IS '국세청 간소화 전산파일에 포함 여부';
