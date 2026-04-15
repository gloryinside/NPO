import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "./types";

/**
 * 현재 요청의 테넌트를 반환한다. middleware가 주입한 x-tenant-id 헤더로부터
 * orgs를 재조회해 Tenant를 리턴한다. 헤더가 없거나 org가 사라졌으면 null.
 *
 * Server Component/Server Action 내부에서만 호출할 수 있다 (next/headers 의존).
 */
export async function getTenant(): Promise<Tenant | null> {
  const h = await headers();
  const id = h.get("x-tenant-id");
  if (!id) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, slug, name, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}

/**
 * 테넌트가 반드시 존재해야 하는 페이지에서 호출한다.
 * 없으면 throw해서 next.js error boundary로 폴백한다.
 */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant();
  if (!tenant) {
    throw new Error("Tenant not found — 서브도메인으로 접근해 주세요.");
  }
  return tenant;
}
