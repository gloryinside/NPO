-- =============================================================================
-- 초기 관리자 계정 시드 (로컬 개발 전용)
-- =============================================================================
-- ⚠️  이 마이그레이션은 **로컬 Supabase 개발 환경**에서만 사용하세요.
--     프로덕션에서는 `node scripts/create-admin.mjs` 를 실행해 Admin API 로
--     안전하게 생성하는 것을 강력히 권장합니다.
--
-- 이 SQL 은 auth.users 에 직접 INSERT 합니다. 장점은 `supabase db reset` 한 번으로
-- 로그인 가능한 상태가 되어 개발 루프가 빠른 것. 단점은 Supabase Auth 가 내부
-- 구현을 바꾸면 깨질 수 있다는 것 (현재 GoTrue v2 기준).
--
-- 생성되는 계정:
--   Email:    admin@demo.example
--   Password: admin1234!
--   Org:      demo (slug 기준)
--   Role:     admin
--
-- 로그인 후 비밀번호를 반드시 변경하세요 (`/admin/login` 로그인 → 우상단 메뉴).
--
-- 프로덕션 Supabase 에서 이 마이그레이션이 돌아도 크래시는 안 나지만,
-- pgcrypto 미설치·auth 스키마 접근 제한 등으로 실패할 수 있으므로 DO 블록에서
-- 조용히 무시하도록 작성했습니다.
-- =============================================================================

-- pgcrypto 확장 (bcrypt 해시용). Supabase 는 기본 포함이지만 안전장치.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $seed_admin$
DECLARE
  v_demo_org_id uuid;
  v_admin_email text := 'admin@demo.example';
  v_admin_password text := 'admin1234!';
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- 1. demo org 가 없으면 스킵 (마이그레이션 20260415000001 먼저 실행 필수)
  SELECT id INTO v_demo_org_id FROM public.orgs WHERE slug = 'demo' LIMIT 1;
  IF v_demo_org_id IS NULL THEN
    RAISE NOTICE '[seed_admin] demo org 가 없어 스킵합니다.';
    RETURN;
  END IF;

  -- 2. 이미 존재하는 계정이면 metadata 만 갱신
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_admin_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'admin', 'org_id', v_demo_org_id)
    WHERE id = v_user_id;
    RAISE NOTICE '[seed_admin] 기존 계정 %의 metadata 를 갱신했습니다.', v_admin_email;
    RETURN;
  END IF;

  -- 3. 신규 계정 생성
  v_user_id := gen_random_uuid();
  v_encrypted_password := crypt(v_admin_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_admin_email,
    v_encrypted_password,
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('role', 'admin', 'org_id', v_demo_org_id),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 4. identities 행도 함께 생성해야 로그인 가능
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_admin_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  RAISE NOTICE '[seed_admin] ✅ 관리자 계정 생성 완료: % / % (org: demo)',
               v_admin_email, v_admin_password;

EXCEPTION WHEN OTHERS THEN
  -- auth 스키마에 접근 권한이 없는 hosted Supabase 등에서는 조용히 스킵
  RAISE NOTICE '[seed_admin] ⚠️  시드 실패 (프로덕션 Supabase 에서는 정상): %', SQLERRM;
END;
$seed_admin$;
