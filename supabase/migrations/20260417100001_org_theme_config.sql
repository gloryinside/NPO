-- 기관별 테마 설정
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT NULL;

COMMENT ON COLUMN orgs.theme_config IS '기관별 공개 페이지 테마 설정 (mode, accent, bg 등 CSS 변수 오버라이드)';
