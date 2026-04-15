-- Task B5: promises 테이블 — 후원 약정
--
-- 후원자가 특정 캠페인에 체결한 후원 계획. 정기(regular) 또는 일시(onetime).
-- 정기 약정은 pay_day(납입일)과 toss_billing_key(자동결제 키)를 가진다.
-- member_id/campaign_id는 RESTRICT — 약정이 있는 후원자/캠페인은 삭제 금지.

CREATE TABLE IF NOT EXISTS promises (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  promise_code      text NOT NULL,
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  campaign_id       uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  type              text NOT NULL CHECK (type IN ('regular','onetime')),
  amount            bigint NOT NULL,
  pay_day           integer CHECK (pay_day BETWEEN 1 AND 28),
  pay_method        text NOT NULL,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','completed')),
  toss_billing_key  text,
  started_at        date NOT NULL,
  ended_at          date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, promise_code)
);

CREATE INDEX IF NOT EXISTS idx_promises_org ON promises(org_id);
CREATE INDEX IF NOT EXISTS idx_promises_member ON promises(member_id);
CREATE INDEX IF NOT EXISTS idx_promises_campaign ON promises(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(org_id, status);
