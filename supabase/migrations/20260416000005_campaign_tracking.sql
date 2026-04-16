-- Campaign tracking and additional fields
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS ga_tracking_id text,
  ADD COLUMN IF NOT EXISTS meta_pixel_id   text,
  ADD COLUMN IF NOT EXISTS pay_methods     text[] DEFAULT ARRAY['card'],
  ADD COLUMN IF NOT EXISTS archived        boolean NOT NULL DEFAULT false;

-- status에 'archived' 추가 (기존 check constraint 교체)
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','active','closed','archived'));

COMMENT ON COLUMN campaigns.ga_tracking_id IS 'Google Analytics 추적 ID (G-XXXXXXXXXX)';
COMMENT ON COLUMN campaigns.meta_pixel_id   IS 'Meta (Facebook) 픽셀 ID';
COMMENT ON COLUMN campaigns.pay_methods     IS '허용 결제수단 배열. 예: ARRAY[''card'',''transfer'']';
