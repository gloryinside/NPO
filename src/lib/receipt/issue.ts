/**
 * 기부금영수증 발급 핵심 — 연말 일괄·관리자 단건·관리자 일괄이 모두 이 모듈을 거친다.
 *
 *  - 집계: KST 달력 연도(pay_date)의 결제 완료분. 부분 환불은 환불액을 뺀 순액, 전액 환불은 제외.
 *    PostgREST 기본 1000행 제한을 넘도록 페이지 단위로 모두 읽는다.
 *  - 번호: next_receipt_seq()(기관·연도 카운터)로 원자적 발급 — 동시 발급에도 중복 없음.
 *  - 멱등: 같은 기부자·연도의 유효 영수증이 있으면 새로 만들지 않고 그것을 돌려준다.
 *    재발급은 reissue=true일 때만 — 새 영수증을 만들고 이전 것은 취소(superseded_by 연결).
 *  - 기관 기재사항(대표자·고유번호 등)이 없으면 발급하지 않는다(법정 서식 필수 항목).
 *  - 실패 시 올린 PDF를 지워 고아 파일·번호 꼬임을 남기지 않는다.
 */
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReceiptCode } from '@/lib/codes'
import { queueErpReceiptEvent } from '@/lib/erp/outbound-queue'
import { generateReceiptPdf, type ReceiptData } from './pdf'
import { checkOrgForReceipt, type FieldIssue, type OrgReceiptFields } from './validation'

export const RECEIPT_BUCKET = 'receipts'
const PAGE = 1000

export type DonationLine = { payDate: string; campaignTitle: string | null; amount: number }
export type MemberDonations = { total: number; payments: DonationLine[] }

type PayRow = {
  member_id: string | null
  amount: number | null
  refund_amount: number | null
  pay_status: string
  pay_date: string | null
  campaigns: { title: string | null } | null
}

/** 결제 1건의 공제 대상 금액(원) */
export function deductibleAmount(p: { amount: number | null; refund_amount: number | null; pay_status: string }): number {
  const amount = Number(p.amount) || 0
  if (p.pay_status === 'paid') return amount
  if (p.pay_status === 'refunded') {
    // refund_amount 없음 = 전액 환불
    const refunded = p.refund_amount == null ? amount : Number(p.refund_amount)
    return Math.max(0, amount - refunded)
  }
  return 0
}

/** 연도별 기부자 집계 */
export async function collectYearDonations(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
  opts: { memberIds?: string[]; requireOptIn: boolean },
): Promise<Map<string, MemberDonations>> {
  const out = new Map<string, MemberDonations>()
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('payments')
      .select('member_id, amount, refund_amount, pay_status, pay_date, campaigns(title)')
      .eq('org_id', orgId)
      .in('pay_status', ['paid', 'refunded'])
      .gte('pay_date', `${year}-01-01`)
      .lt('pay_date', `${year + 1}-01-01`)
      .not('member_id', 'is', null)
      .order('pay_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (opts.requireOptIn) q = q.eq('receipt_opt_in', true)
    if (opts.memberIds?.length) q = q.in('member_id', opts.memberIds)
    const { data, error } = await q
    if (error) throw new Error(`payments 조회 실패: ${error.message}`)
    for (const p of (data ?? []) as unknown as PayRow[]) {
      const amount = deductibleAmount(p)
      if (amount <= 0 || !p.member_id) continue
      const e = out.get(p.member_id) ?? { total: 0, payments: [] }
      e.total += amount
      e.payments.push({ payDate: p.pay_date ?? '', campaignTitle: p.campaigns?.title ?? null, amount })
      out.set(p.member_id, e)
    }
    if ((data?.length ?? 0) < PAGE) break
  }
  return out
}

export type OrgForReceipt = OrgReceiptFields & {
  id: string
  slug: string | null
  contact_phone: string | null
  contact_email: string | null
}

export async function loadOrgForReceipt(supabase: SupabaseClient, orgId: string): Promise<OrgForReceipt | null> {
  const { data } = await supabase
    .from('orgs')
    .select('id, slug, name, business_no, address, contact_phone, contact_email, representative_name, donee_type, donee_legal_basis, donee_code, donation_type_code')
    .eq('id', orgId)
    .maybeSingle()
  return (data as OrgForReceipt | null) ?? null
}

/** 진위 확인 주소 — 기관 서브도메인 */
export function verifyUrl(org: { slug: string | null }, token: string): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN
  if (!base || !org.slug) return null
  return `https://${org.slug}.${base}/verify/receipt/${token}`
}

/** 서식 ❶ 주소 칸 — "(우편번호) 기본 주소 상세 주소" */
export function donorAddress(m: { postal_code?: string | null; address_line1?: string | null; address_line2?: string | null }): string | null {
  const line = [m.address_line1, m.address_line2].map((v) => v?.trim()).filter(Boolean).join(' ')
  if (!line) return null
  return m.postal_code?.trim() ? `(${m.postal_code.trim()}) ${line}` : line
}

/** 후원자 주민등록번호 복호화 — 키·값이 없거나 실패하면 null(영수증의 해당 칸은 빈칸) */
async function decryptMemberIdNumber(supabase: SupabaseClient, cipher: unknown): Promise<string | null> {
  const key = process.env.RECEIPTS_ENCRYPTION_KEY
  if (!cipher || !key) return null
  const { data, error } = await supabase.rpc('decrypt_id_number', { ciphertext: cipher, passphrase: key })
  if (error) {
    console.error('[receipt] 주민등록번호 복호화 실패') // 번호 자체는 남기지 않는다
    return null
  }
  return (data as string | null) ?? null
}

export type IssueResult =
  | { kind: 'issued'; receiptId: string; receiptCode: string; pdf: Buffer; pdfUrl: string | null; total: number }
  | { kind: 'existing'; receiptId: string; receiptCode: string; pdfUrl: string | null }
  | { kind: 'blocked'; issues: FieldIssue[] }
  | { kind: 'no_donations' }
  | { kind: 'failed'; error: string }

export async function issueReceipt(
  supabase: SupabaseClient,
  args: {
    org: OrgForReceipt
    memberId: string
    year: number
    donations: MemberDonations | undefined
    issuedBy: string | null // auth.users.id — 시스템 일괄 발급은 null
    reissue?: boolean
  },
): Promise<IssueResult> {
  const { org, memberId, year, donations } = args

  const blocking = checkOrgForReceipt(org).filter((i) => i.blocking)
  if (blocking.length) return { kind: 'blocked', issues: blocking }
  if (!donations || donations.total <= 0) return { kind: 'no_donations' }

  // 멱등 — 유효(issued) 영수증이 있으면 그대로
  const { data: current } = await supabase
    .from('receipts')
    .select('id, receipt_code, pdf_url, status')
    .eq('org_id', org.id)
    .eq('member_id', memberId)
    .eq('year', year)
    .or('status.is.null,status.eq.issued')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (current && !args.reissue) {
    return { kind: 'existing', receiptId: current.id, receiptCode: current.receipt_code, pdfUrl: current.pdf_url }
  }

  const { data: member } = await supabase
    .from('members')
    .select('name, id_number_encrypted, postal_code, address_line1, address_line2')
    .eq('id', memberId)
    .eq('org_id', org.id)
    .maybeSingle()
  if (!member) return { kind: 'failed', error: 'member_not_found' }
  const idNumber = await decryptMemberIdNumber(supabase, member.id_number_encrypted)

  const { data: seq, error: seqErr } = await supabase.rpc('next_receipt_seq', { p_org: org.id, p_year: year })
  if (seqErr || typeof seq !== 'number') return { kind: 'failed', error: `번호 발급 실패: ${seqErr?.message ?? 'no_seq'}` }

  const receiptCode = generateReceiptCode(year, seq)
  const token = randomBytes(18).toString('base64url')
  const issuedAt = new Date().toISOString()

  const data: ReceiptData = {
    receiptCode,
    year,
    org: {
      name: org.name ?? '',
      businessNo: org.business_no ?? null,
      address: org.address ?? null,
      representativeName: org.representative_name ?? null,
      doneeLegalBasis: org.donee_legal_basis ?? null,
      donationTypeCode: org.donation_type_code ?? null,
    },
    member: { name: member.name, idNumber, address: donorAddress(member) },
    totalAmount: donations.total,
    payments: donations.payments,
    issuedAt,
    verifyUrl: verifyUrl(org, token),
  }

  let pdf: Buffer
  try {
    pdf = await generateReceiptPdf(data)
  } catch (err) {
    return { kind: 'failed', error: `PDF 생성 실패: ${String(err)}` }
  }

  const storagePath = `${org.id}/${year}/${receiptCode}.pdf`
  const { error: upErr } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: false })
  if (upErr) return { kind: 'failed', error: `저장 실패: ${upErr.message}` }

  const { data: signed } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(storagePath, 365 * 24 * 60 * 60)
  const pdfUrl = signed?.signedUrl ?? null

  const { data: inserted, error: insErr } = await supabase
    .from('receipts')
    .insert({
      org_id: org.id,
      receipt_code: receiptCode,
      member_id: memberId,
      year,
      total_amount: donations.total,
      pdf_url: pdfUrl,
      issued_at: issuedAt,
      issued_by: args.issuedBy,
      status: 'issued',
      verify_token: token,
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath])
    return { kind: 'failed', error: `영수증 기록 실패: ${insErr?.message ?? 'insert'}` }
  }

  // 재발급 — 이전 영수증은 취소하고 새 영수증을 가리킨다
  if (current && args.reissue) {
    await supabase
      .from('receipts')
      .update({ status: 'cancelled', superseded_by: inserted.id, cancelled_reason: 'reissued', cancelled_at: issuedAt })
      .eq('id', current.id)
      .eq('org_id', org.id)
  }

  await queueErpReceiptEvent(supabase, org.id, { receiptCode, memberId, year, totalAmount: donations.total, issuedAt })

  return { kind: 'issued', receiptId: inserted.id, receiptCode, pdf, pdfUrl, total: donations.total }
}
