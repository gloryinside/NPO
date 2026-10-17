import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms/nhn-client";
import { sendAlimtalk } from "@/lib/notifications/alimtalk-client";
import { logAudit } from "@/lib/audit";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { adBodyLimit, composeAdSms, isAdQuietHours, type MessagePurpose } from "@/lib/legal/ad-message";

/**
 * POST /api/admin/communications
 * 선택된 후원자에게 수동 SMS 또는 알림톡을 발송한다.
 *
 * Body:
 *   member_ids   string[]          후원자 ID 목록
 *   channel      "sms" | "alimtalk"
 *   message      string            SMS 본문 (최대 90자)
 *   template_code string?          알림톡 전용 템플릿 코드
 *   template_params Record<string,string>?  알림톡 파라미터
 *   purpose      "info" | "ad"     거래·안내(기본) 또는 광고(소식·캠페인 홍보)
 *
 * 광고는 정보통신망법 제50조에 따라: 마케팅 수신 동의자에게만, 야간(21~8시) 금지, '(광고)'·보내는 곳·무료 수신거부를 붙여 보낸다.
 * 알림톡은 정보성 메시지만 보낼 수 있어 광고로 쓸 수 없다.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const { member_ids, channel, message, template_code, template_params, purpose: rawPurpose } = body as {
    purpose?: unknown;
    member_ids?: unknown;
    channel?: unknown;
    message?: unknown;
    template_code?: unknown;
    template_params?: unknown;
  };

  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json({ error: "member_ids 필수" }, { status: 400 });
  }
  if (channel !== "sms" && channel !== "alimtalk") {
    return NextResponse.json({ error: "channel: sms | alimtalk" }, { status: 400 });
  }
  if (channel === "sms") {
    if (!message || typeof message !== "string" || message.length > 90) {
      return NextResponse.json(
        { error: "message 필수 (최대 90자)" },
        { status: 400 }
      );
    }
  } else {
    if (!template_code || typeof template_code !== "string") {
      return NextResponse.json({ error: "template_code 필수 (알림톡)" }, { status: 400 });
    }
  }

  const purpose: MessagePurpose = rawPurpose === "ad" ? "ad" : "info";
  const supabase = createSupabaseAdminClient();

  let smsText = message as string | undefined;
  if (purpose === "ad") {
    if (channel !== "sms") {
      return NextResponse.json({ error: "알림톡은 광고에 쓸 수 없습니다. 문자로 보내 주세요." }, { status: 400 });
    }
    if (isAdQuietHours()) {
      return NextResponse.json({ error: "광고 문자는 밤 9시부터 아침 8시까지 보낼 수 없습니다." }, { status: 400 });
    }
    const { data: org } = await supabase.from("orgs").select("name, contact_phone").eq("id", tenant.id).maybeSingle();
    const optOut = (org?.contact_phone as string | null)?.trim();
    if (!optOut) {
      return NextResponse.json({ error: "광고 문자에는 무료 수신거부 연락처가 필요합니다. 기관 설정에서 대표 전화를 먼저 입력해 주세요." }, { status: 400 });
    }
    const orgName = (org?.name as string) ?? tenant.name;
    const limit = adBodyLimit(orgName, optOut);
    if ((message as string).trim().length > limit) {
      return NextResponse.json({ error: `광고 표시·수신거부 안내를 붙이면 본문은 ${limit}자까지 쓸 수 있습니다.` }, { status: 400 });
    }
    smsText = composeAdSms(orgName, optOut, message as string);
  }

  // 테넌트 소속 회원 및 전화번호 조회
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("id, name, phone, marketing_consent, status")
    .eq("org_id", tenant.id)
    .in("id", member_ids as string[]);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  // 광고는 수신 동의한 후원자에게만, 탈퇴한 후원자에게는 어떤 문자도 보내지 않는다
  const reachable = (members ?? []).filter((m) => m.phone && m.status !== "withdrawn");
  const validMembers = purpose === "ad" ? reachable.filter((m) => m.marketing_consent === true) : reachable;
  const skippedNoConsent = reachable.length - validMembers.length;
  if (validMembers.length === 0) {
    return NextResponse.json(
      { error: purpose === "ad" ? "광고 수신에 동의한 후원자가 없습니다." : "전화번호가 등록된 후원자가 없습니다." },
      { status: 400 },
    );
  }

  // 발송 (비동기 병렬, 결과 수집)
  const results = await Promise.allSettled(
    validMembers.map((m) => {
      if (channel === "sms") {
        return sendSms(m.phone, smsText as string);
      } else {
        return sendAlimtalk(
          m.phone,
          template_code as string,
          (template_params as Record<string, string>) ?? {}
        );
      }
    })
  );

  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  const failed = results.length - succeeded;

  // 감사 로그
  logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "member.invite", // closest available action; metadata clarifies
    resourceType: "communication",
    summary: `수동 ${channel === "sms" ? "SMS" : "알림톡"} 발송 ${succeeded}건 성공, ${failed}건 실패`,
    metadata: {
      channel,
      member_count: validMembers.length,
      succeeded,
      failed,
      template_code: template_code ?? null,
      purpose,
      skipped_no_consent: skippedNoConsent,
    },
  });

  return NextResponse.json({ succeeded, failed, total: validMembers.length, skippedNoConsent });
}
