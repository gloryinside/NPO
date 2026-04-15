-- Task B5: members 테이블 — 후원자
--
-- 후원 의사를 표명하고 등록된 개인/법인. 단순 방문자와 구분.
-- supabase_uid가 설정되면 후원자 마이페이지 로그인과 연결된다.
-- member_code는 기관별로 유일 (UNIQUE(org_id, member_code)).

CREATE TABLE IF NOT EXISTS members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  member_code     text NOT NULL,
  supabase_uid    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  phone           text,
  email           text,
  birth_date      date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deceased')),
  member_type     text NOT NULL DEFAULT 'individual' CHECK (member_type IN ('individual','corporate')),
  join_path       text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, member_code)
);

CREATE INDEX IF NOT EXISTS idx_members_org ON members(org_id);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(org_id, name);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(org_id, email);
CREATE INDEX IF NOT EXISTS idx_members_supabase_uid ON members(supabase_uid) WHERE supabase_uid IS NOT NULL;
