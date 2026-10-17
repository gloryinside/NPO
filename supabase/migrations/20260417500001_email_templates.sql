CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  scenario     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body_json    JSONB NOT NULL,
  body_html    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, scenario)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(org_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- (2026-10-17) 존재하지 않는 admin_users 참조 → is_org_admin()
DROP POLICY IF EXISTS "org_isolation" ON email_templates;
CREATE POLICY "org_isolation" ON email_templates
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

COMMENT ON TABLE email_templates IS '기관별 이메일 템플릿. Tiptap JSON 기반, 시나리오별 1개.';
