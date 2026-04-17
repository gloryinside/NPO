-- 관리자 알림
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_org_unread ON admin_notifications(org_id) WHERE read = FALSE;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_notifications IS '관리자 알림 (결제 실패, 약정 정지 등)';
