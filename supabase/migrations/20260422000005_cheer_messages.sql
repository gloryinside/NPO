-- Phase 5-D: 후원자 응원 메시지(월/벽).
--
-- 후원이 확인된 member만 자기 자격으로 응원 메시지를 남길 수 있다.
-- 공개 여부는 기본 published=true, 관리자가 부적절한 글을 hidden으로 토글.
-- 공개 페이지에서는 published=true AND hidden=false 만 노출.
--
-- 관계:
--   member_id -> members.id (RESTRICT: 응원이 달린 회원은 삭제 보호)
--   campaign_id -> campaigns.id (SET NULL: 캠페인이 삭제되면 일반 응원으로 전환)
--
-- 길이 제한은 DB CHECK로 일차 방어, API에서도 재검증.

CREATE TABLE IF NOT EXISTS cheer_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_id  uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  body         text NOT NULL,
  anonymous    boolean NOT NULL DEFAULT true,
  published    boolean NOT NULL DEFAULT true,
  hidden       boolean NOT NULL DEFAULT false,
  hidden_reason text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cheer_body_length CHECK (char_length(body) BETWEEN 1 AND 500)
);

-- 공개 페이지 스크롤 조회용: org + campaign + created_at DESC
CREATE INDEX IF NOT EXISTS idx_cheer_campaign_created
  ON cheer_messages(org_id, campaign_id, created_at DESC)
  WHERE published = true AND hidden = false;

-- 캠페인 없음(일반 응원) 전용 인덱스
CREATE INDEX IF NOT EXISTS idx_cheer_general_created
  ON cheer_messages(org_id, created_at DESC)
  WHERE campaign_id IS NULL AND published = true AND hidden = false;

-- admin 검색용: 숨김 상태 포함 전체
CREATE INDEX IF NOT EXISTS idx_cheer_org_all
  ON cheer_messages(org_id, created_at DESC);

-- rate limit 보조: 같은 member가 같은 campaign에 너무 자주 쓰는 것을 조회로 확인
CREATE INDEX IF NOT EXISTS idx_cheer_member_campaign
  ON cheer_messages(member_id, campaign_id, created_at DESC);

COMMENT ON TABLE cheer_messages IS 'Phase 5-D: 후원자 응원 메시지 벽';
COMMENT ON COLUMN cheer_messages.anonymous IS '공개 시 이름을 마스킹할지 여부 (true면 김○○ 형태)';
COMMENT ON COLUMN cheer_messages.hidden IS '관리자가 부적절 판단하여 숨긴 상태';
