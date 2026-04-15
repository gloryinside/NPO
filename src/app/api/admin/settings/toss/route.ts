import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return value.slice(0, 8) + "••••" + value.slice(-4);
}

type TossSettingsResponse = {
  tossClientKey: string | null;
  tossSecretKeyMasked: string | null;
  tossWebhookSecretMasked: string | null;
};

export async function GET() {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("org_secrets")
    .select("toss_client_key, toss_secret_key, toss_webhook_secret")
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: TossSettingsResponse = {
    tossClientKey: (data?.toss_client_key as string | null) ?? null,
    tossSecretKeyMasked: maskSecret(
      (data?.toss_secret_key as string | null) ?? null
    ),
    tossWebhookSecretMasked: maskSecret(
      (data?.toss_webhook_secret as string | null) ?? null
    ),
  };

  return NextResponse.json(response);
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

  const updates: Record<string, string | null> = {};

  function normalize(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== "string") return null;
    // Empty string → clear (null). Otherwise trim and store.
    const trimmed = value.trim();
    if (trimmed === "") return null;
    return trimmed;
  }

  if ("tossClientKey" in body) {
    updates.toss_client_key = normalize(body.tossClientKey);
  }
  if ("tossSecretKey" in body) {
    updates.toss_secret_key = normalize(body.tossSecretKey);
  }
  if ("tossWebhookSecret" in body) {
    updates.toss_webhook_secret = normalize(body.tossWebhookSecret);
  }

  const supabase = createSupabaseAdminClient();

  // Upsert so the first save inserts the row and subsequent saves update it.
  const upsertPayload = {
    org_id: tenant.id,
    ...updates,
  };

  const { error: upsertError } = await supabase
    .from("org_secrets")
    .upsert(upsertPayload, { onConflict: "org_id" });

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message },
      { status: 500 }
    );
  }

  // Read back the current row so the response is always in sync with DB.
  const { data, error: readError } = await supabase
    .from("org_secrets")
    .select("toss_client_key, toss_secret_key, toss_webhook_secret")
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const response: TossSettingsResponse = {
    tossClientKey: (data?.toss_client_key as string | null) ?? null,
    tossSecretKeyMasked: maskSecret(
      (data?.toss_secret_key as string | null) ?? null
    ),
    tossWebhookSecretMasked: maskSecret(
      (data?.toss_webhook_secret as string | null) ?? null
    ),
  };

  return NextResponse.json(response);
}
