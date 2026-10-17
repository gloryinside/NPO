import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_PLATFORM = new Set(["ios", "android", "web"]);

/**
 * POST /api/donor/push-tokens
 *   body: { deviceId, platform, token, appVersion? }
 *   같은 (member, deviceId) 면 token 갱신.
 *
 * DELETE /api/donor/push-tokens?deviceId=...
 *   비활성화.
 */
export async function POST(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증" }, { status: 401 });

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const platform = typeof body.platform === "string" ? body.platform : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!deviceId || !VALID_PLATFORM.has(platform) || !token) {
    return NextResponse.json({ error: "deviceId, platform, token 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  // upsert
  const { data: existing } = await supabase
    .from("push_tokens").select("id")
    .eq("member_id", session.member.id).eq("device_id", deviceId).maybeSingle();

  if (existing) {
    await supabase.from("push_tokens").update({
      token, platform, app_version: typeof body.appVersion === "string" ? body.appVersion : null,
      active: true, last_used_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return NextResponse.json({ ok: true, updated: true });
  }

  const { data, error } = await supabase.from("push_tokens").insert({
    org_id: session.member.org_id,
    member_id: session.member.id,
    device_id: deviceId, platform, token,
    app_version: typeof body.appVersion === "string" ? body.appVersion : null,
  }).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, created: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증" }, { status: 401 });

  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  await supabase.from("push_tokens").update({ active: false })
    .eq("member_id", session.member.id).eq("device_id", deviceId);
  return NextResponse.json({ ok: true });
}
