-- Tier A #8: 캠페인별 SEO/OG 필드.
--
-- 제목/설명은 기본값(campaign.title/description) 폴백.
-- og_image_url은 thumbnail_url 폴백.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS seo_title      text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url   text;

COMMENT ON COLUMN campaigns.seo_title IS 'Tier A #8: 검색엔진/공유 시 표시될 제목. 없으면 campaign.title 폴백.';
COMMENT ON COLUMN campaigns.seo_description IS 'Tier A #8: meta description. 없으면 description 폴백.';
COMMENT ON COLUMN campaigns.og_image_url IS 'Tier A #8: OG 이미지 URL. 없으면 thumbnail_url 폴백.';
