-- Task F0-1: org_secrets 테이블 — 기관별 Toss 키/시크릿 저장
--
-- 설계 배경:
-- orgs 테이블은 anon 역할에 public read가 열려 있어 (랜딩 페이지용)
-- Toss secret_key를 orgs에 직접 넣으면 공개된다.
-- 그래서 시크릿성 데이터는 별도 테이블로 분리해 RLS로 admin만 접근하게 한다.
--
-- 저장 형식: Phase 1은 평문.
-- Phase 2 에서 Supabase Vault 또는 AES-256-GCM 대칭 암호화로 전환 예정. (TODO)

CREATE TABLE IF NOT EXISTS org_secrets (
  org_id               uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  toss_client_key      text,
  toss_secret_key      text,
  toss_webhook_secret  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_secrets ENABLE ROW LEVEL SECURITY;

-- admin (user_metadata.role='admin' AND org_id=해당 기관) 만 조회/수정 가능
-- service_role 은 RLS를 우회하므로 서버사이드 결제 로직에서 자유롭게 조회 가능
DROP POLICY IF EXISTS "org_secrets_admin_all" ON org_secrets;
CREATE POLICY "org_secrets_admin_all" ON org_secrets
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
