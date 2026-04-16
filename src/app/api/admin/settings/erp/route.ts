import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return value.slice(0, 8) + "••••" + value.slice(-4);
}

export async function PATCH(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  function normalize(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  const updates: Record<string, string | null> = {};
  if ("erpApiKey" in body) {
    updates.erp_api_key = normalize(body.erpApiKey);
  }
  if ("erpWebhookUrl" in body) {
    const url = normalize(body.erpWebhookUrl);
    // 기본 URL 형식 검증
    if (url && !/^https?:\/\/.+/.test(url)) {
      return NextResponse.json(
        { error: "Webhook URL은 http:// 또는 https://로 시작해야 합니다." },
        { status: 400 }
      );
    }
    updates.erp_webhook_url = url;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { error: upsertError } = await supabase
    .from("org_secrets")
    .upsert({ org_id: tenant.id, ...updates }, { onConflict: "org_id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data, error: readError } = await supabase
    .from("org_secrets")
    .select("erp_api_key, erp_webhook_url")
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  return NextResponse.json({
    erpApiKeyMasked: maskSecret(
      (data as { erp_api_key?: string | null } | null)?.erp_api_key ?? null
    ),
    erpWebhookUrl:
      (data as { erp_webhook_url?: string | null } | null)?.erp_webhook_url ??
      null,
  });
}
