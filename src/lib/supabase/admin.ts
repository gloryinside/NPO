import { createClient } from "@supabase/supabase-js";

/**
 * Service-role 권한으로 동작하는 Supabase 클라이언트.
 * RLS를 우회하므로 서버사이드에서만 사용하고, 브라우저 코드에 절대 import하지 않는다.
 * 테넌트 해석, 웹훅 처리, 공개 랜딩페이지의 org 조회 등에 사용한다.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
