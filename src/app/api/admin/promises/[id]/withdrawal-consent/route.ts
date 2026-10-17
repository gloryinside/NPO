import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";
import { readJsonObject } from "@/lib/http/body";
import { activeConsent, parseConsentInput, recordConsent, revokeConsent } from "@/lib/cms/withdrawal-consent";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 약정의 자동이체 출금동의 기록.
 *   GET    — 유효한 동의(없으면 null)
 *   POST   — 기록(이미 있으면 이전 것을 철회 처리하고 새로) body: { method, payerName, payerRelation, bankName?, account?, consentedAt, evidencePath?, note? }
 *   DELETE — 철회 body: { reason }
 * 기록·철회는 finance 또는 super. 계좌번호는 끝 4자리만 저장한다.
 *
 * 온라인으로 접수된 자동이체 약정은 '등록 대기'(pending_billing)로 만들어진다. 기관이 CMS에 등록하고
 * 출금동의를 받아 여기 기록하면 약정을 '진행 중'으로 바꿔 다음 출금일부터 청구 명단에 오르게 한다.
 */
async function loadPromise(orgId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("promises")
    .select("id, member_id, pay_method, promise_code, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return { supabase, promise: data as { id: string; member_id: string | null; pay_method: string | null; promise_code: string | null; status: string } | null };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;
  const { supabase, promise } = await loadPromise(tenant.id, id);
  if (!promise) return NextResponse.json({ error: "약정을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ consent: await activeConsent(supabase, tenant.id, id) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;

  const input = parseConsentInput(parsed.body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const { supabase, promise } = await loadPromise(tenant.id, id);
  if (!promise) return NextResponse.json({ error: "약정을 찾을 수 없습니다." }, { status: 404 });
  if (promise.pay_method !== "cms") {
    return NextResponse.json({ error: "자동이체(CMS) 약정에만 출금동의를 기록합니다." }, { status: 400 });
  }

  const saved = await recordConsent(supabase, {
    orgId: tenant.id,
    promiseId: id,
    memberId: promise.member_id,
    input: input.value,
    recordedBy: user.id,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 409 });

  // 등록 대기 → 진행 중(출금 준비 완료)
  let activated = false;
  if (promise.status === "pending_billing") {
    const { data: upd } = await supabase
      .from("promises")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", tenant.id)
      .eq("status", "pending_billing")
      .select("id");
    activated = (upd?.length ?? 0) > 0;
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "cms.consent_record",
    resourceType: "promise",
    resourceId: id,
    summary: `출금동의 기록 (${promise.promise_code ?? id})`,
    metadata: { method: input.value.method, payerRelation: input.value.payerRelation, activated },
  });
  return NextResponse.json({ ok: true, id: saved.id, activated });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const reason = typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "철회 사유를 입력해 주세요." }, { status: 400 });

  const { supabase, promise } = await loadPromise(tenant.id, id);
  if (!promise) return NextResponse.json({ error: "약정을 찾을 수 없습니다." }, { status: 404 });
  if (!(await revokeConsent(supabase, { orgId: tenant.id, promiseId: id, reason }))) {
    return NextResponse.json({ error: "철회할 출금동의가 없습니다." }, { status: 404 });
  }
  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "cms.consent_revoke",
    resourceType: "promise",
    resourceId: id,
    summary: `출금동의 철회 (${promise.promise_code ?? id})`,
    metadata: { reason: reason.slice(0, 200) },
  });
  return NextResponse.json({ ok: true });
}
