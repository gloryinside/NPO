/**
 * 기관(테넌트)이 묶인 서비스 롤 DB 접근 — docs/architecture/multi-tenancy.md §4.
 *
 * 서비스 롤 클라이언트는 RLS를 우회한다. 그래서 격리가 "모든 쿼리가 .eq('org_id')를 잊지 않는 것"에
 * 달려 있었다(서비스 롤 사용 파일 356개). 이 헬퍼는 그 조건을 호출부가 빠뜨리거나 바꿀 수 없게 한다.
 *  - select·update·delete: org_id 조건 강제
 *  - insert·upsert: org_id를 덮어쓴다(호출부가 다른 기관 값을 넣어도 무시)
 *  - update: 패치에서 org_id를 지운다(행을 다른 기관으로 옮기지 못하게)
 *  - org_id 없는 테이블은 즉시 오류(조용히 조건을 붙여 엉뚱한 오류를 내지 않게)
 * 반환값은 일반 PostgREST 빌더라 .eq() .order() .range() 등을 이어 쓸 수 있다.
 *
 * 새 코드부터 이 헬퍼를 쓴다. TENANT_TABLES는 tests/unit/tenant/tenant-db.test.ts가 마이그레이션과 맞춰 본다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const TENANT_TABLES = [
  'admin_dashboard_layouts',
  'admin_notifications',
  'admin_roles',
  'audit_logs',
  'automation_rule_runs',
  'automation_rules',
  'bank_accounts',
  'bank_statements',
  'beneficiaries',
  'beneficiary_updates',
  'board_posts',
  'campaign_assets',
  'campaign_versions',
  'campaigns',
  'channel_settlements',
  'chargebacks',
  'chart_of_accounts',
  'cheer_messages',
  'closed_periods',
  'cms_claim_files',
  'cms_claim_lines',
  'code_counters',
  'consultation_logs',
  'corporate_donors',
  'custom_field_definitions',
  'donation_channels',
  'donation_events',
  'donor_testimonials',
  'email_ab_dispatches',
  'email_bounces',
  'email_notifications_log',
  'email_template_versions',
  'email_templates',
  'erp_outbound_webhooks',
  'event_attendances',
  'events',
  'expense_voucher_lines',
  'expense_vouchers',
  'external_donation_imports',
  'external_webhook_subscriptions',
  'fiscal_reports',
  'gift_rules',
  'gift_shipments',
  'in_kind_donations',
  'inquiries',
  'inquiry_replies',
  'journey_sends',
  'journey_steps',
  'mail_campaigns',
  'mail_dispatches',
  'matching_programs',
  'matching_requests',
  'member_audit_log',
  'member_badges',
  'member_segments',
  'member_tag_assignments',
  'member_tags',
  'members',
  'membership_fee_payments',
  'membership_fee_plans',
  'notification_log',
  'nts_export_logs',
  'org_landing_history',
  'org_marketing_spend',
  'org_secrets',
  'org_units',
  'otp_codes',
  'payment_program_allocations',
  'payments',
  'program_budget_items',
  'program_expenses',
  'program_funding',
  'programs',
  'promise_amount_changes',
  'promise_changes_pending',
  'promises',
  'push_dispatches',
  'push_tokens',
  'receipt_counters',
  'receipt_reissue_logs',
  'receipts',
  'referral_codes',
  'referral_rewards',
  'refund_approvals',
  'revenue_journal_lines',
  'revenue_journals',
  'section_templates',
  'settlement_discrepancies',
  'sponsor_letters',
  'sponsorships',
  'survey_responses',
  'surveys',
  'tax_invoices',
  'transparency_disclosures',
  'virtual_account_mappings',
  'volunteer_activities',
  'withdrawal_consents',
] as const

export type TenantTable = (typeof TENANT_TABLES)[number]
const TENANT_SET: ReadonlySet<string> = new Set(TENANT_TABLES)

type Row = Record<string, unknown>

function assertTenantTable(table: string): asserts table is TenantTable {
  if (!TENANT_SET.has(table)) throw new Error(`tenantDb: ${table} 은(는) org_id가 있는 테이블이 아닙니다`)
}

export function tenantDb(orgId: string, client: SupabaseClient = createSupabaseAdminClient()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
    throw new Error('tenantDb: orgId가 올바른 UUID가 아닙니다')
  }
  // 92개 테이블 유니온을 그대로 넘기면 supabase-js 타입 계산이 폭발한다(tsc 메모리 초과) —
  // 실행 시 목록 검사(assertTenantTable)로 보호하고 타입은 string으로 넘긴다
  const from = (table: string) => client.from(table)
  const withOrg = (rows: Row | Row[]) => (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, org_id: orgId }))

  return {
    orgId,
    // 결과 타입은 호출부에서 .returns<Row[]>()로 지정(제네릭 열 파싱은 tsc 메모리를 폭발시킨다)
    select(table: TenantTable, columns: string = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
      assertTenantTable(table)
      return from(table).select(columns, opts).eq('org_id', orgId)
    },
    insert(table: TenantTable, rows: Row | Row[]) {
      assertTenantTable(table)
      return from(table).insert(withOrg(rows))
    },
    upsert(table: TenantTable, rows: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
      assertTenantTable(table)
      return from(table).upsert(withOrg(rows), opts)
    },
    update(table: TenantTable, patch: Row) {
      assertTenantTable(table)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { org_id, ...rest } = patch
      return from(table).update(rest).eq('org_id', orgId)
    },
    delete(table: TenantTable) {
      assertTenantTable(table)
      return from(table).delete().eq('org_id', orgId)
    },
  }
}

export type TenantDb = ReturnType<typeof tenantDb>
