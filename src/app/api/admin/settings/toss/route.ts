import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret, maskPlaintext } from "@/lib/secrets/crypto";

type TossSettingsResponse = {
  tossClientKey: string | null;
  tossSecretKeyMasked: string | null;
  tossWebhookSecretMasked: string | null;
};

type SecretsRow = {
  toss_client_key_enc: string | null;
  toss_secret_key_enc: string | null;
  toss_webhook_secret_enc: string | null;
};

async function loadResponse(orgId: string): Promise<TossSettingsResponse | { error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("org_secrets")
    .select("toss_client_key_enc, toss_secret_key_enc, toss_webhook_secret_enc")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return { error: error.message };

  const row = data as SecretsRow | null;
  const [clientKey, secretKey, webhookSecret] = await Promise.all([
    decryptSecret(row?.toss_client_key_enc ?? null),
    decryptSecret(row?.toss_secret_key_enc ?? null),
    decryptSecret(row?.toss_webhook_secret_enc ?? null),
  ]);

  return {
    tossClientKey: clientKey,
    tossSecretKeyMasked: secretKey ? maskPlaintext(secretKey) : null,
    tossWebhookSecretMasked: webhookSecret ? maskPlaintext(webhookSecret) : null,
  };
}

export async function GET() {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const result = await loadResponse(tenant.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

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
    if (trimmed === "") return null;
    return trimmed;
  }

  // 암호화 대상 필드를 순회하며 *_enc 컬럼으로 변환
  const updates: Record<string, string | null> = {};
  const fieldMap: Array<[string, keyof SecretsRow]> = [
    ["tossClientKey", "toss_client_key_enc"],
    ["tossSecretKey", "toss_secret_key_enc"],
    ["tossWebhookSecret", "toss_webhook_secret_enc"],
  ];

  for (const [bodyKey, dbColumn] of fieldMap) {
    if (!(bodyKey in body)) continue;
    const plain = normalize(body[bodyKey]);
    if (plain === null) {
      updates[dbColumn] = null;
    } else {
      try {
        updates[dbColumn] = await encryptSecret(plain);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "시크릿 암호화에 실패했습니다.",
          },
          { status: 500 }
        );
      }
    }
  }

  const supabase = createSupabaseAdminClient();
  const { error: upsertError } = await supabase
    .from("org_secrets")
    .upsert({ org_id: tenant.id, ...updates }, { onConflict: "org_id" });

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message },
      { status: 500 }
    );
  }

  // 감사 로그
  void logAudit({
    orgId: tenant.id,
    actorId: admin.id,
    actorEmail: admin.email ?? null,
    action: "settings.update_toss",
    resourceType: "org_secrets",
    summary: "Toss 결제 설정 변경",
    metadata: { fields_updated: Object.keys(updates) },
  });

  const result = await loadResponse(tenant.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
