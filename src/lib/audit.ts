/**
 * 감사 로그 헬퍼 (audit_logs 테이블 쓰기).
 *
 * - append-only: UPDATE/DELETE 불가
 * - service_role key 로 작성 (관리자 세션 불필요 — cron 에서도 호출 가능)
 * - fire-and-forget: 로깅 실패가 원래 작업을 막지 않도록 catch 에서 삼킴
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  // 후원자
  | "member.create"
  | "member.update"
  | "member.update_id_number"
  | "member.delete"
  | "member.invite"
  // 약정
  | "promise.create"
  | "promise.update"
  | "promise.suspend"
  | "promise.resume"
  | "promise.cancel"
  // 납입
  | "payment.mark_paid"
  | "payment.mark_unpaid"
  | "payment.retry_cms"
  | "payment.confirm_income"
  // 캠페인
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  // 영수증
  | "receipt.issue"
  | "receipt.nts_export"
  // 설정
  | "settings.update_toss"
  | "settings.update_erp"
  | "settings.update_org"
  // 사용자
  | "user.invite"
  | "user.delete";

/**
 * action별 metadata 필드 권장 스키마 (런타임 강제는 안 함, 조회 시 참조).
 *
 * - member.create / member.update:  { name?, status? }
 * - member.update_id_number:         { id_number_updated: true, name? }
 * - member.delete:                   { name, reason? }
 * - promise.create / update:         { amount?, type?, status? }
 * - promise.suspend / resume:        { previous_status, reason? }
 * - promise.cancel:                  { reason, cancelled_at }
 * - payment.mark_paid / mark_unpaid: { amount?, payment_code? }
 * - payment.retry_cms:               { attempt_count, failure_reason }
 * - payment.confirm_income:          { income_status }
 * - campaign.create / update / delete: { title?, changes? }
 * - receipt.issue:                   { receipt_code, year, total_amount }
 * - receipt.nts_export:              { memberId?, year? }
 * - settings.update_toss / update_erp / update_org: { fields_updated: string[] }
 * - user.invite:                     { email }
 * - user.delete:                     { email, reason? }
 */
export type AuditLogInput = {
  orgId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

/**
 * 감사 로그 기록. Fire-and-forget.
 *
 * 사용 예:
 * ```ts
 * await logAudit({
 *   orgId: tenant.id,
 *   actorId: user.id,
 *   actorEmail: user.email ?? null,
 *   action: "promise.cancel",
 *   resourceType: "promise",
 *   resourceId: promiseId,
 *   summary: `${member.name}의 약정 해지 (${reason})`,
 *   metadata: { reason, cancelled_at: new Date().toISOString() },
 * });
 * ```
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    org_id: input.orgId,
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    // 로깅 실패는 원래 작업을 막지 않음
    console.error("[audit] logAudit failed:", error.message, input);
  }
}
