-- 관리자 주요 조작 감사 로그
-- 후원자 삭제, 약정 해지, 납입 수기 처리, CMS 재출금, 영수증 발급 등 되돌리기 어려운 액션 기록

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id),  -- NULL = system/cron
  actor_email   text,                            -- snapshot (auth.users 삭제 후에도 추적)
  action        text NOT NULL,                   -- 예: 'member.delete', 'promise.cancel', 'payment.mark_paid'
  resource_type text NOT NULL,                   -- 예: 'member', 'promise', 'payment', 'receipt'
  resource_id   uuid,                            -- 대상 리소스 ID (null 허용: bulk 작업 등)
  summary       text,                            -- 사람이 읽을 수 있는 요약
  metadata      jsonb,                           -- 추가 컨텍스트 (before/after, count 등)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id)
  WHERE resource_id IS NOT NULL;

COMMENT ON TABLE audit_logs IS '관리자 주요 조작 감사 로그 (append-only; UPDATE/DELETE 금지)';
COMMENT ON COLUMN audit_logs.action IS '액션 코드 (namespace.verb 형식). 예: member.delete, promise.cancel';
COMMENT ON COLUMN audit_logs.actor_email IS 'actor 계정 삭제 후에도 누가 했는지 추적 가능하게 snapshot 저장';

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 자기 org 로그 읽기 가능
DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit_logs;
CREATE POLICY "audit_logs_admin_select" ON audit_logs
  FOR SELECT
  USING (is_org_admin(org_id));

-- INSERT 는 service_role 만 (서버사이드 헬퍼에서만 삽입)
-- UPDATE/DELETE 정책 없음 → append-only
