-- G-85: 이메일 발송 로그 — cron 중복 발송 방지 + 감사 이메일 단일 발송 보장
--
-- 사용 케이스:
--   1. notify-churn-risk 주간 알림: kind='churn_risk_weekly', 지난 7일 내 발송 기록 있으면 skip
--   2. auto-close-campaigns 감사 이메일: kind='campaign_closed_thanks',
--      ref_id=campaign_id + recipient_email 조합으로 캠페인당 1회만 발송
--
-- recipient_email과 ref_id 조합으로 부분 UNIQUE 인덱스를 두어 동일 대상 중복 행 생성 방지.

CREATE TABLE IF NOT EXISTS email_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                -- 'churn_risk_weekly' | 'campaign_closed_thanks' | 등
  recipient_email TEXT NOT NULL,
  ref_id UUID,                       -- campaign_id / member_id 등 대상 리소스 (NULL 허용)
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- org별 최근 발송 조회
CREATE INDEX idx_email_notifications_log_org_kind_sent
  ON email_notifications_log(org_id, kind, sent_at DESC);

-- 캠페인 감사 이메일 중복 방지 (ref_id가 null이 아닐 때만)
CREATE UNIQUE INDEX idx_email_notifications_log_unique_campaign_thanks
  ON email_notifications_log(kind, ref_id, recipient_email)
  WHERE ref_id IS NOT NULL AND status = 'sent';

ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

-- Admin만 조회 가능 (cron은 service_role key로 RLS bypass)
CREATE POLICY email_notifications_log_admin_read
  ON email_notifications_log FOR SELECT
  USING (org_id IN (SELECT org_id FROM admin_users WHERE supabase_uid = auth.uid()));

COMMENT ON TABLE email_notifications_log IS '자동화 이메일 발송 로그 — 중복 방지 및 감사 추적용';
COMMENT ON COLUMN email_notifications_log.kind IS '이메일 종류 — churn_risk_weekly, campaign_closed_thanks 등';
COMMENT ON COLUMN email_notifications_log.ref_id IS '관련 리소스 ID (campaign_id, member_id 등)';
