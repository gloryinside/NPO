import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send-email";
import { resolveTemplate } from "@/lib/email/resolve-template";
import type { ScenarioKey } from "@/lib/email/default-templates";
import { evaluateConditions } from "./evaluator";
import type {
  AutomationRule,
  TriggerType,
  RuleAction,
  RuleRunResult,
} from "./types";

/**
 * 자동화 룰 디스패처.
 *
 * 사용:
 *   await dispatchTrigger(supabase, orgId, 'payment_paid', { paymentId, amount, member: {...} });
 *
 * 흐름:
 *   1. 활성 룰 중 trigger_type 일치하는 것 조회
 *   2. cooldown 체크 (last_run_at + cooldown_minutes 이내면 skip)
 *   3. 조건 평가
 *   4. 액션 순차 실행 (best-effort)
 *   5. automation_rule_runs 에 로그 + last_run_at 갱신
 */
export async function dispatchTrigger(
  supabase: SupabaseClient,
  orgId: string,
  triggerType: TriggerType,
  payload: Record<string, unknown>,
  targetType?: string,
  targetId?: string,
): Promise<void> {
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("trigger_type", triggerType)
    .eq("active", true);

  if (!rules?.length) return;

  for (const r of rules as AutomationRule[]) {
    // cooldown 체크 (rule 단위, target 무관 — 단순화)
    if (r.last_run_at) {
      const elapsed = Date.now() - new Date(r.last_run_at).getTime();
      if (elapsed < r.cooldown_minutes * 60_000) {
        continue;
      }
    }

    // 조건 평가
    const ev = evaluateConditions(r.conditions ?? [], payload);
    if (!ev.matched) {
      await logRun(supabase, orgId, r.id, "skipped", 0, 0, {
        targetType, targetId, payload,
        errorSummary: `조건 불일치: ${ev.failedConditions?.join("; ")}`,
      });
      continue;
    }

    // 액션 실행
    const result = await runActions(supabase, orgId, r.actions ?? [], payload);
    await logRun(supabase, orgId, r.id, result.status, result.actionsExecuted, result.actionsFailed, {
      targetType, targetId, payload, errorSummary: result.errorSummary,
    });

    // last_run_at 갱신 (cooldown 시작점)
    await supabase
      .from("automation_rules")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: r.run_count + 1,
      })
      .eq("id", r.id);
  }
}

async function runActions(
  supabase: SupabaseClient,
  orgId: string,
  actions: RuleAction[],
  payload: Record<string, unknown>,
): Promise<RuleRunResult> {
  let executed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "send_email_template": {
          const to = (payload.email ?? (payload as { member?: { email?: string } }).member?.email) as string | undefined;
          if (!to) throw new Error("email 주소 없음");
          const scenario = action.params.templateScenario as ScenarioKey;
          const variables = (action.params.variables ?? {}) as Record<string, string>;
          const orgName = (payload.orgName ?? "기관") as string;
          const { subject, html } = await resolveTemplate(orgId, scenario, {
            ...variables,
            orgName,
          });
          const r = await sendEmail({ to, subject, html });
          if (!r.success) throw new Error(r.error ?? "메일 발송 실패");
          break;
        }
        case "admin_notify": {
          const message = (action.params.message ?? "자동화 룰 실행됨") as string;
          await supabase.from("notifications").insert({
            org_id: orgId,
            type: "automation",
            title: "자동화 룰",
            body: message,
            read: false,
          }).then((res) => {
            if (res.error && res.error.code !== "42P01") throw res.error;
          });
          break;
        }
        case "add_tag": {
          const memberId = (payload.memberId ?? (payload as { member?: { id?: string } }).member?.id) as
            string | undefined;
          const tagId = action.params.tagId as string;
          if (!memberId || !tagId) throw new Error("memberId/tagId 누락");
          const { error } = await supabase
            .from("member_tag_assignments")
            .insert({ org_id: orgId, member_id: memberId, tag_id: tagId });
          // UNIQUE 위반은 무시 (이미 부여됨)
          if (error && error.code !== "23505") throw error;
          break;
        }
        case "update_member_field": {
          const memberId = (payload.memberId ?? (payload as { member?: { id?: string } }).member?.id) as
            string | undefined;
          const field = action.params.field as string;
          const value = action.params.value;
          if (!memberId || !field) throw new Error("memberId/field 누락");
          // 화이트리스트 (보안)
          const ALLOWED = new Set(["status", "join_path", "ref_code", "tier", "tier_overridden"]);
          if (!ALLOWED.has(field)) throw new Error(`허용되지 않은 필드: ${field}`);
          await supabase
            .from("members")
            .update({ [field]: value })
            .eq("id", memberId)
            .eq("org_id", orgId);
          break;
        }
        case "send_alimtalk": {
          // 외부 알림톡 발송 lib는 별도 구현 — 현재는 noop + 로그만
          console.warn("[automation] send_alimtalk: 미구현 (외부 lib 필요)", action.params);
          break;
        }
        default: {
          throw new Error(`알 수 없는 액션 타입: ${action.type}`);
        }
      }
      executed++;
    } catch (err) {
      failed++;
      errors.push(`${action.type}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const status: RuleRunResult["status"] =
    failed === 0 ? "success" : executed === 0 ? "failed" : "partial";

  return {
    status,
    actionsExecuted: executed,
    actionsFailed: failed,
    errorSummary: errors.length ? errors.join(" | ") : undefined,
  };
}

async function logRun(
  supabase: SupabaseClient,
  orgId: string,
  ruleId: string,
  status: "success" | "partial" | "failed" | "skipped",
  executed: number,
  failed: number,
  meta: { targetType?: string; targetId?: string; payload?: unknown; errorSummary?: string },
): Promise<void> {
  await supabase.from("automation_rule_runs").insert({
    org_id: orgId,
    rule_id: ruleId,
    target_type: meta.targetType ?? null,
    target_id: meta.targetId ?? null,
    status,
    actions_executed: executed,
    actions_failed: failed,
    error_summary: meta.errorSummary ?? null,
    trigger_payload: meta.payload ?? null,
  }).then((res) => {
    if (res.error) console.error("[automation] log run failed:", res.error.message);
  });
}
