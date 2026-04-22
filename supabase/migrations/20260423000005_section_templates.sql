-- Tier A #7: 페이지 빌더 공통 섹션 템플릿.
--
-- 관리자가 한 번 잘 만든 섹션(임팩트 스토리, 재무 투명성 등)을 저장하고
-- 다른 캠페인 편집 시 불러와 재사용.

CREATE TABLE IF NOT EXISTS section_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  variant_id  text NOT NULL,          -- 어떤 섹션 variant인지 (hero-classic, impact-stats 등)
  block       jsonb NOT NULL,          -- 블록 JSON 전체 (BlocksSchema의 단일 블록)
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_templates_org
  ON section_templates(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_section_templates_variant
  ON section_templates(org_id, variant_id);

COMMENT ON TABLE section_templates IS
  'Tier A #7: 페이지 빌더 섹션 템플릿 (org 단위 공유 라이브러리)';

ALTER TABLE section_templates ENABLE ROW LEVEL SECURITY;
