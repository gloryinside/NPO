/**
 * 자동이체 출금동의 기록 — 누가 출금하든(외부 CMS 프로그램, 토스 계좌 자동결제) 증빙이 필요하다.
 * 테이블: withdrawal_consents (계좌번호 원문은 저장하지 않고 끝 4자리만)
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const CONSENT_METHODS = ['pg_registration', 'electronic_signature', 'ars_recording', 'paper'] as const
export type ConsentMethod = (typeof CONSENT_METHODS)[number]

export const CONSENT_METHOD_LABEL: Record<ConsentMethod, string> = {
  pg_registration: '결제사 등록 창',
  electronic_signature: '전자서명',
  ars_recording: 'ARS 녹취',
  paper: '서면(종이)',
}

export const PAYER_RELATIONS = ['self', 'spouse', 'parent', 'child', 'family', 'company', 'other'] as const
export type PayerRelation = (typeof PAYER_RELATIONS)[number]

export const PAYER_RELATION_LABEL: Record<PayerRelation, string> = {
  self: '본인',
  spouse: '배우자',
  parent: '부모',
  child: '자녀',
  family: '그 밖의 가족',
  company: '법인·단체',
  other: '기타',
}

export type ConsentInput = {
  method: ConsentMethod
  payerName: string
  payerRelation: PayerRelation
  bankName: string | null
  accountLast4: string | null
  consentedAt: string // YYYY-MM-DD 또는 ISO
  evidencePath: string | null
  note: string | null
  provider: string | null
  providerRef: string | null
}

export type ConsentParse = { ok: true; value: ConsentInput } | { ok: false; error: string }

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** 관리자 입력 검증 — 계좌번호를 통째로 넣어도 끝 4자리만 남긴다 */
export function parseConsentInput(body: Record<string, unknown>, now: Date = new Date()): ConsentParse {
  const method = body.method as ConsentMethod
  if (!CONSENT_METHODS.includes(method)) return { ok: false, error: '동의 방법을 골라 주세요.' }
  const payerName = str(body.payerName, 50)
  if (!payerName) return { ok: false, error: '예금주(결제자) 이름을 입력해 주세요.' }
  const payerRelation = (body.payerRelation ?? 'self') as PayerRelation
  if (!PAYER_RELATIONS.includes(payerRelation)) return { ok: false, error: '후원자와의 관계를 골라 주세요.' }

  const digits = typeof body.account === 'string' ? body.account.replace(/[^0-9]/g, '') : ''
  if (digits && digits.length < 4) return { ok: false, error: '계좌번호 끝 4자리 이상을 입력해 주세요.' }

  const consentedRaw = str(body.consentedAt, 40)
  const consented = consentedRaw ? new Date(consentedRaw) : null
  if (!consented || Number.isNaN(consented.getTime())) return { ok: false, error: '동의한 날짜를 입력해 주세요.' }
  if (consented.getTime() > now.getTime() + 60_000) return { ok: false, error: '동의 날짜가 미래일 수 없습니다.' }

  return {
    ok: true,
    value: {
      method,
      payerName,
      payerRelation,
      bankName: str(body.bankName, 30),
      accountLast4: digits ? digits.slice(-4) : null,
      consentedAt: consented.toISOString(),
      evidencePath: str(body.evidencePath, 300),
      note: str(body.note, 500),
      provider: str(body.provider, 30),
      providerRef: str(body.providerRef, 100),
    },
  }
}

export type ConsentRow = {
  id: string
  method: ConsentMethod
  payer_name: string
  payer_relation: PayerRelation
  bank_name: string | null
  account_last4: string | null
  consented_at: string
  revoked_at: string | null
  note: string | null
}

const COLS = 'id, method, payer_name, payer_relation, bank_name, account_last4, consented_at, revoked_at, note'

/** 약정의 유효한(철회 안 된) 동의 */
export async function activeConsent(supabase: SupabaseClient, orgId: string, promiseId: string): Promise<ConsentRow | null> {
  const { data } = await supabase
    .from('withdrawal_consents')
    .select(COLS)
    .eq('org_id', orgId)
    .eq('promise_id', promiseId)
    .is('revoked_at', null)
    .maybeSingle()
  return (data as ConsentRow | null) ?? null
}

/** 여러 약정 중 유효한 동의가 있는 것들 */
export async function promisesWithConsent(supabase: SupabaseClient, orgId: string, promiseIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < promiseIds.length; i += 500) {
    const { data } = await supabase
      .from('withdrawal_consents')
      .select('promise_id')
      .eq('org_id', orgId)
      .in('promise_id', promiseIds.slice(i, i + 500))
      .is('revoked_at', null)
    for (const r of (data ?? []) as Array<{ promise_id: string }>) out.add(r.promise_id)
  }
  return out
}

/**
 * 동의를 기록한다. 이미 유효한 동의가 있으면 그것을 철회 처리하고 새로 남긴다(예금주·계좌 변경).
 */
export async function recordConsent(
  supabase: SupabaseClient,
  args: { orgId: string; promiseId: string; memberId: string | null; input: ConsentInput; recordedBy: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const prev = await activeConsent(supabase, args.orgId, args.promiseId)
  if (prev) {
    const { error } = await supabase
      .from('withdrawal_consents')
      .update({ revoked_at: new Date().toISOString(), revoked_reason: 'replaced' })
      .eq('id', prev.id)
      .eq('org_id', args.orgId)
      .is('revoked_at', null)
    if (error) return { ok: false, error: '이전 동의를 정리하지 못했습니다.' }
  }
  const i = args.input
  const { data, error } = await supabase
    .from('withdrawal_consents')
    .insert({
      org_id: args.orgId,
      promise_id: args.promiseId,
      member_id: args.memberId,
      method: i.method,
      payer_name: i.payerName,
      payer_relation: i.payerRelation,
      bank_name: i.bankName,
      account_last4: i.accountLast4,
      provider: i.provider,
      provider_ref: i.providerRef,
      evidence_path: i.evidencePath,
      note: i.note,
      consented_at: i.consentedAt,
      recorded_by: args.recordedBy,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: '그사이 다른 동의가 기록됐습니다. 새로고침 후 확인해 주세요.' }
    return { ok: false, error: '출금동의를 저장하지 못했습니다.' }
  }
  return { ok: true, id: (data as { id: string }).id }
}

export async function revokeConsent(
  supabase: SupabaseClient,
  args: { orgId: string; promiseId: string; reason: string },
): Promise<boolean> {
  const { data } = await supabase
    .from('withdrawal_consents')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: args.reason.slice(0, 200) })
    .eq('org_id', args.orgId)
    .eq('promise_id', args.promiseId)
    .is('revoked_at', null)
    .select('id')
  return (data?.length ?? 0) > 0
}
