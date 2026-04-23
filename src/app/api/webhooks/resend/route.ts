import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/rate-limit";
import { reportEvent } from "@/lib/observability/report";

/**
 * G-D132: Resend webhook — email.bounced / email.complained / email.delivery_delayed
 *
 * Resend 는 svix 헤더 서명을 사용한다 (svix-id, svix-timestamp, svix-signature).
 * RESEND_WEBHOOK_SECRET 기반 HMAC-SHA256.
 *
 * body 예:
 *   { type: 'email.bounced', data: { email_id, to: ['...'], bounce: { type, ... } } }
 */
type BounceType = "hard" | "soft" | "complaint" | "delivery_delay";

function mapType(eventType: string, data: Record<string, unknown>): BounceType | null {
  if (eventType === "email.bounced") {
    const bt = ((data.bounce as { type?: string } | undefined)?.type ?? "hard").toLowerCase();
    if (bt.includes("soft")) return "soft";
    return "hard";
  }
  if (eventType === "email.complained") return "complaint";
  if (eventType === "email.delivery_delayed") return "delivery_delay";
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 서명 검증 (선택): RESEND_WEBHOOK_SECRET 설정된 경우만
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature");
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json({ error: "missing signature" }, { status: 401 });
    }
    // Resend 는 base64(secret) 로 hmac. 단순 검증만 수행.
    const signed = `${svixId}.${svixTs}.${rawBody}`;
    const expected = crypto
      .createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64"))
      .update(signed)
      .digest("base64");
    const provided = svixSig.split(" ").find((p) => p.startsWith("v1,"));
    const providedB64 = provided?.slice(3);
    if (
      !providedB64 ||
      !crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(providedB64)
      )
    ) {
      await reportEvent("webhook.resend.signature_invalid", {
        domain: "webhook",
        tags: { ip: getClientIp(req.headers) },
      });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: { type?: string; data?: Record<string, unknown>; id?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? "";
  const data = payload.data ?? {};
  const bounceType = mapType(eventType, data);
  if (!bounceType) {
    // 처리 대상 이벤트 아님 — 200 으로 흘려보냄
    return NextResponse.json({ ok: true, skipped: true });
  }

  const toArr = Array.isArray(data.to) ? (data.to as string[]) : [];
  const email = toArr[0]?.toLowerCase() ?? null;
  if (!email) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const providerEventId =
    typeof data.email_id === "string"
      ? (data.email_id as string)
      : payload.id ?? null;

  const supabase = createSupabaseAdminClient();

  // org_id 매핑: members.email 일치 기관 찾기 (best-effort)
  const { data: memberMatch } = await supabase
    .from("members")
    .select("id, org_id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  await supabase.from("email_bounces").insert({
    org_id: memberMatch?.org_id ?? null,
    recipient_email: email,
    bounce_type: bounceType,
    provider: "resend",
    provider_event_id: providerEventId,
    reason:
      typeof (data.bounce as { message?: string })?.message === "string"
        ? ((data.bounce as { message: string }).message as string).slice(0, 500)
        : null,
    raw: data,
  });

  // hard/complaint 이면 member 이메일 비활성
  if ((bounceType === "hard" || bounceType === "complaint") && memberMatch) {
    await supabase
      .from("members")
      .update({
        email_disabled: true,
        email_disabled_reason: bounceType,
      })
      .eq("id", memberMatch.id);
  }

  return NextResponse.json({ ok: true });
}
