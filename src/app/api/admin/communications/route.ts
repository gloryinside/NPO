import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms/nhn-client";
import { sendAlimtalk } from "@/lib/notifications/alimtalk-client";
import { logAudit } from "@/lib/audit";

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
 */
export async function POST(req: NextRequest) {
  const user = await requireAdminUser();
  const tenant = await requireTenant();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_ids, channel, message, template_code, template_params } = body as {
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

  const supabase = createSupabaseAdminClient();

  // 테넌트 소속 회원 및 전화번호 조회
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("id, name, phone")
    .eq("org_id", tenant.id)
    .in("id", member_ids as string[]);

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const validMembers = (members ?? []).filter((m) => m.phone);
  if (validMembers.length === 0) {
    return NextResponse.json({ error: "전화번호가 등록된 후원자가 없습니다." }, { status: 400 });
  }

  // 발송 (비동기 병렬, 결과 수집)
  const results = await Promise.allSettled(
    validMembers.map((m) => {
      if (channel === "sms") {
        return sendSms(m.phone, message as string);
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
    },
  });

  return NextResponse.json({ succeeded, failed, total: validMembers.length });
}
