import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "./types";

const RESERVED_SLUGS = new Set(["www", "platform", "api", "admin"]);

/**
 * 요청의 Host 헤더에서 테넌트 slug를 추출한다.
 * - 프로덕션: `{slug}.supporters.kr` 형태
 * - 개발: `{slug}.localhost:3000` 형태
 * - 루트/예약어는 null
 *
 * 이 함수는 순수 함수이며 DB 접근이 없다.
 */
export function extractSlugFromHost(host: string): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  // localhost 개발환경: `slug.localhost` 형태
  if (parts[parts.length - 1] === "localhost") {
    if (parts.length < 2) return null;
    const slug = parts[0];
    if (RESERVED_SLUGS.has(slug)) return null;
    return slug;
  }

  // 프로덕션: `slug.domain.tld` 형태 (최소 3 파트)
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

/**
 * 호스트를 orgs 테이블에서 조회해 활성 테넌트를 반환한다.
 * DB 쿼리를 수행하므로 middleware/서버 컴포넌트에서만 호출한다.
 *
 * 개발 편의: 서브도메인이 없는 순수 localhost 접근 시
 * DEV_TENANT_SLUG 환경변수가 설정돼 있으면 해당 slug로 fallback한다.
 */
export async function resolveTenant(host: string): Promise<Tenant | null> {
  let slug = extractSlugFromHost(host);

  // DEV fallback: localhost:3000 직접 접근 시 환경변수 slug 사용
  if (!slug && process.env.NODE_ENV !== "production") {
    const devSlug = process.env.DEV_TENANT_SLUG;
    if (devSlug) slug = devSlug;
  }

  if (!slug) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}
