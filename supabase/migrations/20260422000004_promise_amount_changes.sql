-- Phase 5-C: 정기후원 금액 변경 이력
--
-- donor 또는 admin이 약정 금액을 변경할 때마다 한 행씩 기록한다.
-- 변경 전/후 금액, direction(up|down|same), 주체(member|admin|system), 사유(선택)를 남겨
-- 회계/감사/분석 목적에 쓴다. promises.amount는 항상 "최신값"만 보관하므로
-- 시계열 추적은 이 테이블이 유일한 원천이다.

CREATE TABLE IF NOT EXISTS promise_amount_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  promise_id      uuid NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  previous_amount bigint NOT NULL,
  new_amount      bigint NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('up','down','same')),
  actor           text NOT NULL CHECK (actor IN ('member','admin','system')),
  actor_id        uuid,                  -- supabase user id or admin user id (선택)
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pac_promise
  ON promise_amount_changes(promise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pac_org
  ON promise_amount_changes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pac_member
  ON promise_amount_changes(member_id, created_at DESC);

COMMENT ON TABLE promise_amount_changes IS 'Phase 5-C: 정기후원 약정 금액 변경 이력';
COMMENT ON COLUMN promise_amount_changes.direction IS '변경 방향: up(증액), down(감액), same(동일 금액 재확인)';
COMMENT ON COLUMN promise_amount_changes.actor IS '변경 주체: member(후원자 본인), admin(관리자), system(자동)';
