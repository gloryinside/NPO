import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import {
  decryptSecret,
  encryptSecret,
  hashApiKey,
  maskPlaintext,
} from "@/lib/secrets/crypto";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser();

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
  const auditedFields: string[] = [];

  if ("erpApiKey" in body) {
    const plain = normalize(body.erpApiKey);
    if (plain === null) {
      updates.erp_api_key_enc = null;
      updates.erp_api_key_hash = null;
    } else {
      try {
        updates.erp_api_key_enc = await encryptSecret(plain);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "ERP API 키 암호화에 실패했습니다.",
          },
          { status: 500 }
        );
      }
      updates.erp_api_key_hash = hashApiKey(plain);
    }
    auditedFields.push("erpApiKey");
  }

  if ("erpWebhookUrl" in body) {
    const url = normalize(body.erpWebhookUrl);
    if (url && !/^https?:\/\/.+/.test(url)) {
      return NextResponse.json(
        { error: "Webhook URL은 http:// 또는 https://로 시작해야 합니다." },
        { status: 400 }
      );
    }
    updates.erp_webhook_url = url;
    auditedFields.push("erpWebhookUrl");
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
    .select("erp_api_key_enc, erp_webhook_url")
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const row = data as
    | { erp_api_key_enc?: string | null; erp_webhook_url?: string | null }
    | null;
  const decrypted = await decryptSecret(row?.erp_api_key_enc ?? null);

  // 감사 로그
  void logAudit({
    orgId: tenant.id,
    actorId: admin.id,
    actorEmail: admin.email ?? null,
    action: "settings.update_erp",
    resourceType: "org_secrets",
    summary: "ERP 연동 설정 변경",
    metadata: { fields_updated: auditedFields },
  });

  return NextResponse.json({
    erpApiKeyMasked: decrypted ? maskPlaintext(decrypted) : null,
    erpWebhookUrl: row?.erp_webhook_url ?? null,
  });
}
