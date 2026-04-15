-- Task B5: campaigns 테이블 — 모금 캠페인
--
-- 각 기관(org)이 진행하는 후원 모금 프로젝트 단위.
-- 공개 URL 식별자(slug), 목표금액, 결제 설정(pg_config), 금액 프리셋을 포함한다.
-- 한 기관 내에서 slug는 유일하되 기관 간에는 중복 가능 (UNIQUE(org_id, slug)).

CREATE TABLE IF NOT EXISTS campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  donation_type   text NOT NULL CHECK (donation_type IN ('regular','onetime','both')),
  goal_amount     bigint,
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  pg_config       jsonb,
  preset_amounts  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(org_id, status);
