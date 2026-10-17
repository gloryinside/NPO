import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/erp/outbound-queue', () => ({ queueErpPaymentEvent: vi.fn(async () => {}) }))

import { buildClaimCsv, listClaimablePayments, createClaim, applyClaimResult } from '@/lib/cms/claim'
import { queueErpPaymentEvent } from '@/lib/erp/outbound-queue'

/** 아주 작은 메모리 DB — eq/in/is/lte 필터와 insert/update/delete만 흉내 낸다 */
type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>) {
  let seq = 0
  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row | Row[] | null = null
    const rows = () => (tables[table] ??= [])
    const join = (r: Row): Row => {
      if (table === 'payments') {
        const m = (tables.members ?? []).find((x) => x.id === r.member_id) ?? null
        return { ...r, members: m }
      }
      if (table === 'cms_claim_lines') {
        const p = (tables.payments ?? []).find((x) => x.id === r.payment_id)
        const m = p ? (tables.members ?? []).find((x) => x.id === p.member_id) ?? null : null
        return { ...r, payments: p ? { payment_code: p.payment_code, members: m } : null }
      }
      return r
    }
    const run = (): { data: unknown; error: null } => {
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: `${table}-${++seq}`, result_code: null, ...r }))
        rows().push(...list)
        return { data: list, error: null }
      }
      const hit = rows().filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, payload))
        return { data: hit, error: null }
      }
      if (op === 'delete') {
        tables[table] = rows().filter((r) => !hit.includes(r))
        return { data: hit, error: null }
      }
      return { data: hit.map(join), error: null }
    }
    const q = {
      select: () => q,
      insert: (p: Row | Row[]) => ((op = 'insert'), (payload = p), q),
      update: (p: Row) => ((op = 'update'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      lte: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) <= v), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => {
        const { data } = run()
        return { data: (data as Row[])[0] ?? null, error: null }
      },
      single: async () => {
        const { data } = run()
        return { data: (data as Row[])[0] ?? null, error: null }
      },
      then: (res: (v: { data: unknown; error: null }) => unknown) => Promise.resolve(run()).then(res),
    }
    return q
  }
  return { client: { from } as never, tables }
}

function seed() {
  return fakeDb({
    members: [
      { id: 'm1', name: '김후원', member_code: 'M-001' },
      { id: 'm2', name: '=HYPERLINK("x")', member_code: 'M-002' },
    ],
    payments: [
      { id: 'p1', org_id: 'o1', member_id: 'm1', payment_code: 'PAY-1', amount: 10000, pay_date: '2026-10-10', pay_method: 'cms', pay_status: 'pending' },
      { id: 'p2', org_id: 'o1', member_id: 'm2', payment_code: 'PAY-2', amount: 20000, pay_date: '2026-10-15', pay_method: 'cms', pay_status: 'unpaid' },
      { id: 'p3', org_id: 'o1', member_id: 'm1', payment_code: 'PAY-3', amount: 30000, pay_date: '2026-10-10', pay_method: 'card', pay_status: 'pending' },
      { id: 'p4', org_id: 'o1', member_id: 'm1', payment_code: 'PAY-4', amount: 40000, pay_date: '2026-11-10', pay_method: 'cms', pay_status: 'pending' },
      { id: 'p5', org_id: 'o2', member_id: 'm1', payment_code: 'PAY-5', amount: 50000, pay_date: '2026-10-10', pay_method: 'cms', pay_status: 'pending' },
    ],
    cms_claim_files: [],
    cms_claim_lines: [],
  })
}

describe('자동이체(CMS) 청구', () => {
  it('출금일까지 도래한 우리 기관 CMS 결제만 고른다(카드·미래·다른 기관 제외)', async () => {
    const { client } = seed()
    const list = await listClaimablePayments(client, 'o1', '2026-10-17')
    expect(list.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('CSV는 BOM·한글 머리줄이 있고, 수식처럼 시작하는 이름은 무력화한다', () => {
    const csv = buildClaimCsv(
      [{ id: 'p2', paymentCode: 'PAY-2', amount: 20000, payDate: null, memberName: '=HYPERLINK("x")', memberCode: 'M-002' }],
      '2026-10-17',
    )
    expect(csv.startsWith('﻿순번,후원자번호,이름,출금금액,출금일,결제번호')).toBe(true)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('명단에 넣은 결제는 결과가 나오기 전까지 다음 명단에서 빠진다', async () => {
    const { client } = seed()
    const r = await createClaim(client, { orgId: 'o1', claimDate: '2026-10-17', paymentIds: ['p1', 'p2'], createdBy: 'u1' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.totalAmount).toBe(30000)
    expect(await listClaimablePayments(client, 'o1', '2026-10-17')).toEqual([])
  })

  it('다른 기관·청구 불가 결제가 섞이면 만들지 않는다', async () => {
    const { client, tables } = seed()
    const r = await createClaim(client, { orgId: 'o1', claimDate: '2026-10-17', paymentIds: ['p1', 'p5'], createdBy: 'u1' })
    expect(r.ok).toBe(false)
    expect(tables.cms_claim_files).toHaveLength(0)
  })

  it('결과 반영: 체크한 건만 실패, 나머지는 완료 + ERP 큐, 두 번 반영되지 않는다', async () => {
    const { client, tables } = seed()
    const r = await createClaim(client, { orgId: 'o1', claimDate: '2026-10-17', paymentIds: ['p1', 'p2'], createdBy: 'u1' })
    if (!r.ok) throw new Error('create failed')
    const failLine = tables.cms_claim_lines.find((l) => l.payment_id === 'p2')!.id as string

    const res = await applyClaimResult(client, { orgId: 'o1', fileId: r.claimFileId, failedLineIds: [failLine], failReason: '잔액 부족', depositDate: '2026-10-17' })
    expect(res).toEqual({ ok: true, paid: 1, failed: 1 })
    const pay = (id: string) => tables.payments.find((p) => p.id === id)!
    expect(pay('p1')).toMatchObject({ pay_status: 'paid', deposit_date: '2026-10-17' })
    expect(pay('p2')).toMatchObject({ pay_status: 'failed', fail_reason: '잔액 부족' })
    expect(queueErpPaymentEvent).toHaveBeenCalledWith(client, 'o1', 'p1', 'payment.paid')
    expect(tables.cms_claim_files[0]).toMatchObject({ status: 'completed', success_count: 1, fail_count: 1 })

    const again = await applyClaimResult(client, { orgId: 'o1', fileId: r.claimFileId, failedLineIds: [], depositDate: '2026-10-18' })
    expect(again.ok).toBe(false)
    expect(pay('p1').deposit_date).toBe('2026-10-17')
  })
})
