-- Task: audit_logs INSERT/UPDATE/DELETE 정책 명시화
--
-- 기존 마이그레이션(20260416000007)은 SELECT 정책만 두고 INSERT/UPDATE/DELETE는
-- "service_role만" 이라는 주석으로만 표현했다. RLS 활성화 + 정책 없음 상태에서는
-- non-service-role 세션이 해당 작업을 시도하면 모두 거부되긴 하지만, 의도 명확화를
-- 위해 명시적 정책을 추가한다.
--
-- service_role은 RLS 자체를 우회하므로, 여기서 정의하는 authenticated/anon 대상
-- 정책과는 무관하다. 본 정책은 "절대 안 됨"을 명시적으로 선언하는 문서성 역할.

-- INSERT: anon/authenticated 모두 차단 (service_role만 RLS 우회로 INSERT 허용)
DROP POLICY IF EXISTS "audit_logs_no_client_insert" ON audit_logs;
CREATE POLICY "audit_logs_no_client_insert" ON audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- UPDATE: 모든 역할 차단 (append-only 강제)
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- DELETE: 모든 역할 차단 (append-only 강제)
DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs
  FOR DELETE
  TO anon, authenticated
  USING (false);
