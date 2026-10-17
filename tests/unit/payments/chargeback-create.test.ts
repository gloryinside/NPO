import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const db: { payment: Row | null; open: Row | null; inserted: Row[]; memberUpdates: Row[] } = {
  payment: null,
  open: null,
  inserted: [],
  memberUpdates: [],
}
let finance = true

vi.mock('@/lib/auth/api-guard', () => ({
  requireAdminApi: vi.fn(async () => ({ ok: true, ctx: { tenant: { id: 'org-1' }, user: { id: 'u1', email: 'a@x.test' } } })),
}))
vi.mock('@/lib/auth/admin-rbac', () => ({ hasAnyRole: vi.fn(async () => finance) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const q: Record<string, unknown> = {}
      let insertRow: Row | null = null
      let isUpdate = false
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        in: () => q,
        insert: (r: Row) => ((insertRow = r), q),
        update: (r: Row) => {
          isUpdate = true
          if (table === 'members') db.memberUpdates.push(r)
          return q
        },
        maybeSingle: async () => ({ data: table === 'payments' ? db.payment : db.open }),
        single: async () => {
          db.inserted.push(insertRow!)
          return { data: { id: 'cb-1' }, error: null }
        },
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, isUpdate }).then(res),
      })
      return q
    },
  }),
}))

import { POST } from '@/app/api/admin/chargebacks/route'

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/chargebacks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost' },
    body: JSON.stringify(body),
  })

describe('POST /api/admin/chargebacks (이의 제기 직접 등록)', () => {
  beforeEach(() => {
    finance = true
    db.payment = { id: 'p1', amount: 30000, member_id: 'm1', pay_status: 'paid', pay_method: 'card' }
    db.open = null
    db.inserted = []
    db.memberUpdates = []
  })

  it('결제번호·사유가 없으면 400', async () => {
    expect((await POST(req({ reason: 'x' }))).status).toBe(400)
    expect((await POST(req({ paymentCode: 'PAY-1' }))).status).toBe(400)
  })

  it('회계 권한이 없으면 403', async () => {
    finance = false
    expect((await POST(req({ paymentCode: 'PAY-1', reason: '본인 아님' }))).status).toBe(403)
  })

  it('없는 결제 404, 완료되지 않은 결제 400, 결제금액 초과 400', async () => {
    db.payment = null
    expect((await POST(req({ paymentCode: 'PAY-X', reason: 'r' }))).status).toBe(404)
    db.payment = { id: 'p1', amount: 30000, member_id: 'm1', pay_status: 'failed' }
    expect((await POST(req({ paymentCode: 'PAY-1', reason: 'r' }))).status).toBe(400)
    db.payment = { id: 'p1', amount: 30000, member_id: 'm1', pay_status: 'paid' }
    expect((await POST(req({ paymentCode: 'PAY-1', reason: 'r', amount: 30001 }))).status).toBe(400)
    expect(db.inserted).toHaveLength(0)
  })

  it('진행 중인 건이 있으면 409', async () => {
    db.open = { id: 'cb-0' }
    expect((await POST(req({ paymentCode: 'PAY-1', reason: 'r' }))).status).toBe(409)
  })

  it('등록하면 금액 기본값은 결제금액, 후원자에 분쟁 표시', async () => {
    const res = await POST(req({ paymentCode: 'PAY-1', reason: '본인이 결제하지 않음' }))
    expect(res.status).toBe(201)
    expect(db.inserted[0]).toMatchObject({ org_id: 'org-1', payment_id: 'p1', member_id: 'm1', amount: 30000, status: 'open' })
    expect(db.memberUpdates).toEqual([{ chargeback_risk: true }])
  })
})
