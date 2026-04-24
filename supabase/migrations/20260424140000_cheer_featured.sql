-- G-D174: 관리자 큐레이션 — 대표 응원(Featured) 기능.
--
-- 관리자가 공개된 응원 중 캠페인별 최대 3건을 "대표 응원"으로 선정.
-- 선정된 응원은 해당 캠페인 공개 페이지의 응원 벽 최상단에
-- "⭐ 대표 응원" 섹션으로 고정 노출된다.
--
-- 설계:
--   - featured_at timestamptz: NULL이면 미지정, 값이 있으면 featured 상태 + 정렬 기준
--   - boolean + timestamp 두 컬럼 대신 단일 컬럼으로 상태·정렬을 동시에 표현
--   - 4번째 featured 시도 시 API 레이어에서 oldest 자동 해제 (캠페인별 3건 제한)
--   - published=true AND hidden=false 인 응원만 featured 가능 (비공개 글은 대표 불가)

ALTER TABLE cheer_messages
  ADD COLUMN IF NOT EXISTS featured_at timestamptz;

-- 캠페인별 featured 조회 전용 partial index (상단 노출 쿼리 핫패스)
CREATE INDEX IF NOT EXISTS idx_cheer_featured
  ON cheer_messages(org_id, campaign_id, featured_at DESC)
  WHERE featured_at IS NOT NULL
    AND published = true
    AND hidden = false;

COMMENT ON COLUMN cheer_messages.featured_at IS
  'G-D174: 관리자가 대표 응원으로 선정한 시각. NULL이면 일반, 값이 있으면 featured 상태 + 노출 정렬 기준';
