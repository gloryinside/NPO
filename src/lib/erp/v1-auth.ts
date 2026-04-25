import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/secrets/crypto";

export type V1AuthSuccess = { orgId: string };
export type V1AuthError = { error: string; status: number };

/**
 * 외부 ERP가 v1 API를 호출할 때 인증.
 * Bearer 토큰의 SHA-256 hash로 org_secrets.erp_api_key_hash 매칭.
 */
export async function authenticateV1(
  req: NextRequest,
): Promise<V1AuthSuccess | V1AuthError> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { error: "Bearer token required", status: 401 };
  }
  const token = auth.slice(7).trim();
  if (!token) return { error: "Empty token", status: 401 };

  const tokenHash = hashApiKey(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("org_secrets")
    .select("org_id")
    .eq("erp_api_key_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return { error: "Invalid API key", status: 401 };
  return { orgId: data.org_id };
}
