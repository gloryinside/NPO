-- Task B2: orgs 테이블 — SaaS 테넌트 마스터
--
-- 각 비영리단체(기관)가 이 테이블의 한 행으로 표현된다.
-- 서브도메인 slug 또는 custom_domain으로 테넌트를 식별한다.
-- 향후 모든 업무 테이블(campaigns, members, promises, payments, receipts)은
-- org_id FK로 이 테이블을 참조하며 RLS 정책이 이를 기준으로 격리한다.

CREATE TABLE IF NOT EXISTS orgs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  business_no     text,
  logo_url        text,
  hero_image_url  text,
  tagline         text,
  about           text,
  contact_email   text,
  contact_phone   text,
  address         text,
  show_stats      boolean NOT NULL DEFAULT true,
  custom_domain   text UNIQUE,
  plan            text NOT NULL DEFAULT 'basic',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug ON orgs(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_custom_domain ON orgs(custom_domain) WHERE custom_domain IS NOT NULL;

-- 공개 랜딩페이지는 익명 사용자도 기관 정보를 읽어야 하므로 RLS + public read 정책
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_public_read" ON orgs;
CREATE POLICY "orgs_public_read" ON orgs
  FOR SELECT
  USING (status = 'active');

-- 시드 데이터: 개발/테스트용 2개 기관
INSERT INTO orgs (slug, name, tagline, about, contact_email)
VALUES
  ('demo', '데모 복지재단', '함께하는 나눔, 변화의 시작', '데모 복지재단은 소외된 이웃을 돕는 비영리단체입니다.', 'contact@demo.example'),
  ('hope', '희망 어린이재단', '아이들의 꿈을 지켜주세요', '희망 어린이재단은 아동 복지를 위해 설립되었습니다.', 'info@hope.example')
ON CONFLICT (slug) DO NOTHING;
