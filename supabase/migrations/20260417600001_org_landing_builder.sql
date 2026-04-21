-- 기관 랜딩페이지 섹션 빌더 지원
-- orgs 테이블에 page_content / published_content / published_at 컬럼 추가
-- page_content  : 편집 중인 섹션 블록 배열 (schemaVersion + sections[])
-- published_content : 마지막 게시된 스냅샷
-- published_at  : 마지막 게시 시각

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS page_content      JSONB NOT NULL DEFAULT '{"schemaVersion":1,"sections":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ;

COMMENT ON COLUMN orgs.page_content      IS '기관 랜딩페이지 에디터 콘텐츠 — schemaVersion + sections 배열';
COMMENT ON COLUMN orgs.published_content IS '공개된 기관 랜딩페이지 스냅샷 (게시 시점의 page_content 사본)';
COMMENT ON COLUMN orgs.published_at      IS '마지막 게시(발행) 시각';

-- theme_config, bank_name, bank_account, account_holder 컬럼이 없으면 추가
-- (이전 마이그레이션에서 누락된 경우 대비)
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS theme_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_name       TEXT,
  ADD COLUMN IF NOT EXISTS bank_account    TEXT,
  ADD COLUMN IF NOT EXISTS account_holder  TEXT;
