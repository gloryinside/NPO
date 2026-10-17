/**
 * 후원자 여정 메시지 — 매일 한 번 돌며 오늘 보낼 대상을 찾아 보낸다.
 *
 *  - 단계 설정: journey_steps(없으면 기본값). 꺼진 단계는 건너뛴다.
 *  - 중복 방지: journey_sends (기관, 단계, 후원자, 기간) 유일 — 먼저 기록을 잡고(insert) 성공한 것만 보낸다.
 *    그래서 작업이 겹쳐 돌아도 두 번 가지 않는다. 보내기에 실패하면 failed로 남기고 다시 보내지 않는다.
 *  - 받는 사람: 이메일 있음, 반송으로 막히지 않음, 상태 정상, 알림 설정에서 끄지 않음(notification_prefs.journey),
 *    사업 소개는 마케팅 수신 동의자만.
 *  - 지금은 이메일만 보낸다. 알림톡 채널로 설정된 단계는 카카오 연동 전까지 건너뛴다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { kstToday } from "@/lib/billing/kst";
import { formatKRW } from "@/lib/format";
import { sendEmail } from "@/lib/email/send-email";
import { addDays, anniversaryDays, fullYears, kstDayRange } from "./dates";
import { renderJourneyEmail, type JourneyVars } from "./render";
import { effectiveSteps, type EffectiveStep, type JourneyStepKey, type JourneyStepRow } from "./steps";

export type JourneyTarget = {
  memberId: string;
  periodKey: string;
  vars: JourneyVars;
};

type Org = { id: string; name: string; slug: string | null };

type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  email_disabled: boolean | null;
  marketing_consent: boolean | null;
  notification_prefs: Record<string, unknown> | null;
  status: string | null;
};

export type SendFn = (msg: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string }>;

export function orgSiteUrl(slug: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  return base && slug ? `https://${slug}.${base}` : null;
}

/** 받을 수 있는 후원자인지 */
export function eligible(m: MemberRow, step: Pick<EffectiveStep, "needsMarketingConsent">): boolean {
  if (!m.email || m.email_disabled) return false;
  if ((m.status ?? "active") !== "active") return false;
  if (m.notification_prefs && m.notification_prefs.journey === false) return false;
  if (step.needsMarketingConsent && !m.marketing_consent) return false;
  return true;
}

/** 단계별 오늘 대상 */
export async function findTargets(
  supabase: SupabaseClient,
  orgId: string,
  key: JourneyStepKey,
  today: string,
): Promise<JourneyTarget[]> {
  if (key === "welcome_d1" || key === "intro_d7") {
    const { from, to } = kstDayRange(addDays(today, key === "welcome_d1" ? -1 : -7));
    const { data } = await supabase
      .from("promises")
      .select("id, member_id, amount, started_at")
      .eq("org_id", orgId)
      .eq("type", "regular")
      .in("status", ["active", "pending_billing"])
      .gte("created_at", from)
      .lt("created_at", to)
      .limit(5000);
    return ((data ?? []) as Array<{ id: string; member_id: string | null; amount: number; started_at: string | null }>)
      .filter((p) => p.member_id)
      .map((p) => ({
        memberId: p.member_id as string,
        periodKey: p.id,
        vars: { 금액: formatKRW(p.amount), 시작일: p.started_at ?? "" },
      }));
  }

  if (key === "thanks_30d") {
    const day = addDays(today, -30);
    const { data } = await supabase
      .from("payments")
      .select("member_id, amount")
      .eq("org_id", orgId)
      .eq("pay_status", "paid")
      .eq("pay_date", day)
      .not("member_id", "is", null)
      .limit(5000);
    const firstByMember = new Map<string, number>();
    for (const p of (data ?? []) as Array<{ member_id: string; amount: number }>) {
      if (!firstByMember.has(p.member_id)) firstByMember.set(p.member_id, Number(p.amount));
    }
    const ids = [...firstByMember.keys()];
    const notFirst = new Set<string>();
    const legacy = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data: earlier } = await supabase
        .from("payments")
        .select("member_id")
        .eq("org_id", orgId)
        .eq("pay_status", "paid")
        .lt("pay_date", day)
        .in("member_id", chunk);
      for (const r of (earlier ?? []) as Array<{ member_id: string }>) notFirst.add(r.member_id);
      // 예전 감사 편지 작업으로 이미 받은 사람
      const { data: sentBefore } = await supabase
        .from("notification_log")
        .select("ref_key")
        .eq("org_id", orgId)
        .eq("template", "thank_you_letter_30d")
        .in("ref_key", chunk);
      for (const r of (sentBefore ?? []) as Array<{ ref_key: string }>) legacy.add(r.ref_key);
    }
    return ids
      .filter((id) => !notFirst.has(id) && !legacy.has(id))
      .map((id) => ({ memberId: id, periodKey: "once", vars: { 금액: formatKRW(firstByMember.get(id) ?? 0) } }));
  }

  const { month, days } = anniversaryDays(today);
  const year = today.slice(0, 4);

  if (key === "anniversary") {
    const { data, error } = await supabase.rpc("journey_anniversary_promises", {
      p_org: orgId,
      p_month: month,
      p_days: days,
      p_today: today,
    });
    if (error) throw new Error(`기념일 조회 실패: ${error.message}`);
    // 한 사람이 같은 날 시작한 약정이 여럿이면 한 번만
    const seen = new Set<string>();
    const out: JourneyTarget[] = [];
    for (const p of (data ?? []) as Array<{ member_id: string | null; amount: number; started_at: string }>) {
      if (!p.member_id || seen.has(p.member_id)) continue;
      seen.add(p.member_id);
      out.push({
        memberId: p.member_id,
        periodKey: year,
        vars: { 금액: formatKRW(p.amount), 시작일: p.started_at, 후원기간: `${fullYears(p.started_at, today)}년` },
      });
    }
    return out;
  }

  // birthday
  const { data, error } = await supabase.rpc("journey_birthday_members", { p_org: orgId, p_month: month, p_days: days });
  if (error) throw new Error(`생일 조회 실패: ${error.message}`);
  return ((data ?? []) as Array<{ id: string }>).map((m) => ({ memberId: m.id, periodKey: year, vars: {} }));
}

export type StepReport = { step: JourneyStepKey; targets: number; sent: number; failed: number; skipped: number };

/** 한 기관의 오늘 여정 메시지 */
export async function runJourneyForOrg(
  supabase: SupabaseClient,
  org: Org,
  opts: { today?: string; send?: SendFn } = {},
): Promise<StepReport[]> {
  const today = opts.today ?? kstToday();
  const send = opts.send ?? sendEmail;

  const { data: rows } = await supabase
    .from("journey_steps")
    .select("step_key, enabled, channel, subject, body")
    .eq("org_id", org.id);
  const steps = effectiveSteps((rows ?? []) as JourneyStepRow[]).filter((s) => s.enabled && s.channel === "email");

  const site = orgSiteUrl(org.slug);
  const reports: StepReport[] = [];

  for (const step of steps) {
    const targets = await findTargets(supabase, org.id, step.key, today);
    const report: StepReport = { step: step.key, targets: targets.length, sent: 0, failed: 0, skipped: 0 };
    if (targets.length === 0) {
      reports.push(report);
      continue;
    }

    const members = new Map<string, MemberRow>();
    const ids = [...new Set(targets.map((t) => t.memberId))];
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await supabase
        .from("members")
        .select("id, name, email, email_disabled, marketing_consent, notification_prefs, status")
        .eq("org_id", org.id)
        .in("id", ids.slice(i, i + 500));
      for (const m of (data ?? []) as MemberRow[]) members.set(m.id, m);
    }

    for (const t of targets) {
      const m = members.get(t.memberId);
      if (!m || !eligible(m, step)) {
        report.skipped++;
        continue;
      }
      // 먼저 기록을 잡는다 — 이미 있으면(다른 실행이 보냈거나 보낸 적 있음) 건너뛴다
      const { data: claimed, error: claimErr } = await supabase
        .from("journey_sends")
        .insert({ org_id: org.id, step_key: step.key, member_id: m.id, period_key: t.periodKey, channel: "email", status: "sent" })
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) {
        report.skipped++;
        continue;
      }

      const vars: JourneyVars = {
        이름: m.name ?? "후원자",
        기관명: org.name,
        마이페이지: site ? `${site}/donor` : "",
        ...t.vars,
      };
      const msg = renderJourneyEmail(step, vars, { orgName: org.name, settingsUrl: site ? `${site}/donor/settings` : null, ad: step.needsMarketingConsent });
      const res = await send({ to: m.email as string, subject: msg.subject, html: msg.html });
      if (res.success) {
        report.sent++;
      } else {
        report.failed++;
        await supabase
          .from("journey_sends")
          .update({ status: "failed", error: (res.error ?? "발송 실패").slice(0, 300) })
          .eq("id", (claimed as { id: string }).id);
      }
    }
    reports.push(report);
  }
  return reports;
}

/** 모든 기관 */
export async function runJourneys(supabase: SupabaseClient, opts: { today?: string; send?: SendFn } = {}) {
  const { data: orgs } = await supabase.from("orgs").select("id, name, slug");
  const out: Array<{ orgId: string; steps: StepReport[]; error?: string }> = [];
  for (const org of (orgs ?? []) as Org[]) {
    try {
      out.push({ orgId: org.id, steps: await runJourneyForOrg(supabase, org, opts) });
    } catch (e) {
      out.push({ orgId: org.id, steps: [], error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
