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

CREATE INDEX idx_email_templates_org ON email_templates(org_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON email_templates
  FOR ALL USING (
    org_id = (SELECT org_id FROM admin_users WHERE supabase_uid = auth.uid() LIMIT 1)
  );

COMMENT ON TABLE email_templates IS '기관별 이메일 템플릿. Tiptap JSON 기반, 시나리오별 1개.';
