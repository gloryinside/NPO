-- Phase 4-B: 기관별 설정 JSONB 컬럼.
--
-- 용도:
--   - weekly_alert_enabled: 주간 이탈 위험 알림 수신 여부 (기본 true)
--   - impact_unit_amount: 후원자 임팩트 페이지의 "지원 추정" 분모 단가 (기본 100_000)
--   - 기타 향후 기관 커스텀 설정 확장 영역
--
-- 새 컬럼은 NULL 허용하지 않고 빈 객체 default. 읽기 시 기본값 fallback은 lib에서 처리.

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN orgs.settings IS '기관별 설정 (알림 수신, 임팩트 단가, 등)';
