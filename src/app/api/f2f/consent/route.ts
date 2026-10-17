import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/context";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { parseConsentInput, recordConsent } from "@/lib/cms/withdrawal-consent";
import { CONSENT_WINDOW_MS, decodeSignature, resolveAgent } from "@/lib/f2f/agents";

/**
 * POST /api/f2f/consent — 현장 모금(태블릿)에서 받은 자동이체 출금동의 서명
 *   { token, paymentId, payerName, payerRelation, bankName, account(끝 4자리), signature(PNG data URL) }
 *
 * 조건: 같은 모금가 링크로 1시간 안에 접수된 자동이체 정기후원 신청. 서명 이미지는 비공개 버킷(consent-evidence)에 둔다.
 * 기록되면 출금동의 대기 약정이 진행 중으로 바뀐다(관리자 화면에서 기록할 때와 같다).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`f2f:consent:${ip}`, 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const tenant = await requireTenant();
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const supabase = createSupabaseAdminClient();
  const agent = await resolveAgent(supabase, tenant.id, body.token);
  if (!agent) return NextResponse.json({ error: "현장 모금 링크가 만료되었거나 중지되었습니다." }, { status: 403 });

  const signature = decodeSignature(body.signature);
  if (!signature) return NextResponse.json({ error: "서명 이미지를 읽지 못했어요. 다시 서명해 주세요." }, { status: 400 });

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const { data: payment } = await supabase
    .from("payments")
    .select("id, member_id, promise_id, pay_method, created_at, f2f_agent_id")
    .eq("id", paymentId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (
    !payment ||
    payment.f2f_agent_id !== agent.id ||
    !payment.promise_id ||
    payment.pay_method !== "cms" ||
    Date.now() - new Date(payment.created_at as string).getTime() > CONSENT_WINDOW_MS
  ) {
    return NextResponse.json({ error: "이 신청에는 서명을 받을 수 없습니다. 담당자에게 문의해 주세요." }, { status: 400 });
  }

  const now = new Date();
  const input = parseConsentInput(
    {
      method: "electronic_signature",
      payerName: body.payerName,
      payerRelation: body.payerRelation,
      bankName: body.bankName,
      account: body.account,
      consentedAt: now.toISOString(),
      note: `현장 모금 ${agent.name}(${agent.code})`,
    },
    now,
  );
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!input.value.accountLast4) return NextResponse.json({ error: "계좌번호 끝 4자리를 적어 주세요." }, { status: 400 });

  const path = `${tenant.id}/${payment.promise_id}/${randomUUID()}.png`;
  const { error: upErr } = await supabase.storage
    .from("consent-evidence")
    .upload(path, signature, { contentType: "image/png", upsert: false });
  if (upErr) {
    console.error("[f2f/consent] upload failed:", upErr.message);
    return NextResponse.json({ error: "서명을 저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  const saved = await recordConsent(supabase, {
    orgId: tenant.id,
    promiseId: payment.promise_id,
    memberId: payment.member_id,
    input: { ...input.value, evidencePath: path },
    recordedBy: null,
  });
  if (!saved.ok) {
    await supabase.storage.from("consent-evidence").remove([path]);
    return NextResponse.json({ error: saved.error }, { status: 409 });
  }

  const { data: upd } = await supabase
    .from("promises")
    .update({ status: "active", updated_at: now.toISOString() })
    .eq("id", payment.promise_id)
    .eq("org_id", tenant.id)
    .eq("status", "pending_billing")
    .select("id");

  await logAudit({
    orgId: tenant.id,
    actorId: null,
    actorEmail: null,
    action: "f2f.consent_sign",
    resourceType: "promise",
    resourceId: payment.promise_id,
    summary: `현장 출금동의 서명 (${agent.name}/${agent.code})`,
    metadata: { consentId: saved.id, activated: (upd?.length ?? 0) > 0 },
  });
  return NextResponse.json({ ok: true });
}
