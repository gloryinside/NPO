import { describe, it, expect } from 'vitest'
import { promotePendingIdNumber } from '@/lib/receipt/pending-id'

/** 결제 1건·후원자 1명짜리 메모리 DB */
function db(payment: Record<string, unknown>, member: Record<string, unknown>) {
  const tables: Record<string, Record<string, unknown>[]> = { payments: [payment], members: [member] }
  const from = (t: string) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = []
    let patch: Record<string, unknown> | null = null
    const q = {
      select: () => q,
      update: (p: Record<string, unknown>) => ((patch = p), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      maybeSingle: async () => ({ data: tables[t].find((r) => filters.every((f) => f(r))) ?? null }),
      then: (res: (v: unknown) => unknown) => {
        const hit = tables[t].filter((r) => filters.every((f) => f(r)))
        if (patch) hit.forEach((r) => Object.assign(r, patch))
        return Promise.resolve({ data: hit, error: null }).then(res)
      },
    }
    return q
  }
  return { client: { from } as never, payment: tables.payments[0], member: tables.members[0] }
}

describe('신청 때 받은 주민번호 옮기기', () => {
  const pay = (extra = {}) => ({ id: 'p1', org_id: 'o1', member_id: 'm1', rrn_pending_encrypted: 'CIPHER', pay_status: 'paid', ...extra })

  it('돈이 들어온 결제면 비어 있는 후원자에게 옮기고 결제 행에서 지운다', async () => {
    const { client, payment, member } = db(pay(), { id: 'm1', org_id: 'o1', id_number_encrypted: null })
    await promotePendingIdNumber(client, 'o1', 'p1')
    expect(member.id_number_encrypted).toBe('CIPHER')
    expect(payment.rrn_pending_encrypted).toBeNull()
  })

  it('이미 번호가 있는 후원자는 덮어쓰지 않는다', async () => {
    const { client, payment, member } = db(pay(), { id: 'm1', org_id: 'o1', id_number_encrypted: 'ORIGINAL' })
    await promotePendingIdNumber(client, 'o1', 'p1')
    expect(member.id_number_encrypted).toBe('ORIGINAL')
    expect(payment.rrn_pending_encrypted).toBeNull()
  })

  it('아직 돈이 안 들어온 결제(접수만)는 옮기지 않는다', async () => {
    const { client, payment, member } = db(pay({ pay_status: 'pending' }), { id: 'm1', org_id: 'o1', id_number_encrypted: null })
    await promotePendingIdNumber(client, 'o1', 'p1')
    expect(member.id_number_encrypted).toBeNull()
    expect(payment.rrn_pending_encrypted).toBe('CIPHER')
  })

  it('다른 기관의 결제는 건드리지 않는다', async () => {
    const { client, member } = db(pay(), { id: 'm1', org_id: 'o1', id_number_encrypted: null })
    await promotePendingIdNumber(client, 'o2', 'p1')
    expect(member.id_number_encrypted).toBeNull()
  })
})
