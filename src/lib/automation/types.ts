/**
 * 자동화 룰 타입 정의.
 */

export type TriggerType =
  | "payment_paid"
  | "payment_failed"
  | "promise_created"
  | "promise_cancelled"
  | "member_inactive_days"
  | "cumulative_milestone"
  | "birthday";

export type ConditionOp = "eq" | "ne" | "gte" | "lte" | "gt" | "lt" | "in" | "contains";

export interface RuleCondition {
  field: string; // payload 내 경로 (예: 'amount', 'member.tier')
  op: ConditionOp;
  value: unknown;
}

export type ActionType =
  | "send_email_template"
  | "send_alimtalk"
  | "admin_notify"
  | "add_tag"
  | "update_member_field";

export interface RuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  active: boolean;
  cooldown_minutes: number;
  last_run_at: string | null;
  run_count: number;
}

export interface RuleEvalResult {
  matched: boolean;
  failedConditions?: string[];
}

export interface RuleRunResult {
  status: "success" | "partial" | "failed" | "skipped";
  actionsExecuted: number;
  actionsFailed: number;
  errorSummary?: string;
}
