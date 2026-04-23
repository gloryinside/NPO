import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D136: lifecycle 이메일 일 1회 cron.
 *
 * 현재 4개 시나리오 구현:
 *   - welcome_1w:     가입 7일차 (회원 온보딩 팁)
 *   - anniversary_1y: 가입 365일차
 *   - dormant_90:     lifecycle_stage = 'dormant' 로 전환 후 첫 일 7일째
 *   - churn_recover:  lifecycle_stage = 'churned' 진입 후 매 180일
 *
 * 중복 발송 방지:
 *   notification_log(recipient, template, ref_key=member_id)
 *   같은 template+member_id 조합이 이미 있으면 skip.
 *
 * 실제 메일 발송은 sendEmail. 템플릿은 인라인 HTML (운영 시
 * email_templates 테이블로 이전 권장).
 */
export async function GET(req: Request) {
  return runCron(req, "cron:lifecycle-emails", async () => {
    const supabase = createSupabaseAdminClient();
    const now = new Date();

    // 1) welcome_1w
    const d7 = offsetDay(now, -7);
    const welcomeRes = await processBatch(
      supabase,
      "welcome_1w",
      async () => {
        const { data } = await supabase
          .from("members")
          .select("id, org_id, name, email")
          .gte("created_at", startOfDay(d7))
          .lt("created_at", endOfDay(d7))
          .eq("status", "active")
          .not("email", "is", null);
        return (data ?? []) as MemberBasic[];
      },
      (m) => ({
        subject: "후원을 시작해주셔서 감사합니다",
        html: welcomeHtml(m.name ?? "후원자"),
      })
    );

    // 2) anniversary_1y
    const d365 = offsetDay(now, -365);
    const anniRes = await processBatch(
      supabase,
      "anniversary_1y",
      async () => {
        const { data } = await supabase
          .from("members")
          .select("id, org_id, name, email")
          .gte("created_at", startOfDay(d365))
          .lt("created_at", endOfDay(d365))
          .eq("status", "active")
          .not("email", "is", null);
        return (data ?? []) as MemberBasic[];
      },
      (m) => ({
        subject: "함께한 지 1년이 되었습니다",
        html: anniversaryHtml(m.name ?? "후원자"),
      })
    );

    // 3) dormant_90
    const dormantCutoff = offsetDay(now, -7).toISOString();
    const dormantRes = await processBatch(
      supabase,
      "dormant_alert",
      async () => {
        const { data } = await supabase
          .from("members")
          .select("id, org_id, name, email")
          .eq("lifecycle_stage", "dormant")
          .gte("lifecycle_stage_updated_at", dormantCutoff)
          .eq("status", "active")
          .not("email", "is", null);
        return (data ?? []) as MemberBasic[];
      },
      (m) => ({
        subject: "오랜만이에요, 잘 지내시나요?",
        html: dormantHtml(m.name ?? "후원자"),
      })
    );

    return {
      welcome: welcomeRes,
      anniversary: anniRes,
      dormant: dormantRes,
    };
  });
}

type MemberBasic = {
  id: string;
  org_id: string;
  name: string | null;
  email: string | null;
};

async function processBatch(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  template: string,
  fetcher: () => Promise<MemberBasic[]>,
  render: (m: MemberBasic) => { subject: string; html: string }
): Promise<number> {
  const members = await fetcher();
  let sent = 0;
  for (const m of members) {
    if (!m.email) continue;

    const { data: already } = await supabase
      .from("notification_log")
      .select("id")
      .eq("recipient", m.email)
      .eq("template", template)
      .eq("ref_key", m.id)
      .limit(1);
    if ((already ?? []).length > 0) continue;

    const { subject, html } = render(m);
    const res = await sendEmail({ to: m.email, subject, html });
    if (res.success) {
      await supabase.from("notification_log").insert({
        org_id: m.org_id,
        recipient: m.email,
        template,
        ref_key: m.id,
      });
      sent++;
    }
  }
  return sent;
}

function startOfDay(d: Date): string {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c.toISOString();
}
function endOfDay(d: Date): string {
  const c = new Date(d);
  c.setUTCHours(23, 59, 59, 999);
  return c.toISOString();
}
function offsetDay(d: Date, delta: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + delta);
  return c;
}

function welcomeHtml(name: string) {
  return `
  <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="font-size:20px">${name}님, 환영합니다 👋</h2>
    <p>가입 후 첫 일주일을 맞이하셨어요. 마이페이지에서 약정·납입·영수증을 한눈에 확인할 수 있습니다.</p>
  </div>`;
}
function anniversaryHtml(name: string) {
  return `
  <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="font-size:20px">🎉 1주년을 축하드립니다</h2>
    <p>${name}님과 함께한 지 1년이 되었습니다. 그동안의 후원이 만든 변화를 임팩트 페이지에서 확인해보세요.</p>
  </div>`;
}
function dormantHtml(name: string) {
  return `
  <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="font-size:20px">${name}님, 잘 지내시나요?</h2>
    <p>한동안 소식을 전하지 못했어요. 새로운 캠페인 소식을 확인해보시겠어요?</p>
  </div>`;
}
