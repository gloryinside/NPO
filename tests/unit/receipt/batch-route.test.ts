import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const issueAnnualReceipts = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdminUser: vi.fn(async () => ({ id: 'admin-1', email: 'a@x.test' })) }))
vi.mock('@/lib/tenant/context', () => ({ requireTenant: vi.fn(async () => ({ id: 'org-1' })) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }))
vi.mock('@/lib/receipt/annual-batch', () => ({ issueAnnualReceipts: (...a: unknown[]) => issueAnnualReceipts(...a) }))

import { POST, MAX_BATCH } from '@/app/api/admin/receipts/batch/route'

const ID = '11111111-1111-4111-8111-111111111111'
const req = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/receipts/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost' },
    body: JSON.stringify(body),
  })

describe('POST /api/admin/receipts/batch', () => {
  beforeEach(() => issueAnnualReceipts.mockReset())

  it('연도·대상 검증', async () => {
    expect((await POST(req({ year: 'x', memberIds: [ID] }))).status).toBe(400)
    expect((await POST(req({ year: 2026, memberIds: ['not-uuid'] }))).status).toBe(400)
    const many = Array.from({ length: MAX_BATCH + 1 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`)
    expect((await POST(req({ year: 2026, memberIds: many }))).status).toBe(400)
    expect(issueAnnualReceipts).not.toHaveBeenCalled()
  })

  it('관리자 발급은 영수증 신청 여부와 무관, 발급자 기록', async () => {
    issueAnnualReceipts.mockResolvedValue({ issued: 1, skipped: 0, failed: 0 })
    const res = await POST(req({ year: 2026, memberIds: [ID, ID] }))
    expect(res.status).toBe(200)
    expect(issueAnnualReceipts).toHaveBeenCalledWith('org-1', 2026, { memberIds: [ID], requireOptIn: false, issuedBy: 'admin-1' })
  })

  it('기관 기재사항 누락이면 422와 사유', async () => {
    issueAnnualReceipts.mockResolvedValue({ issued: 0, skipped: 0, failed: 0, blocked: ['대표자 성명이 없습니다.'] })
    const res = await POST(req({ year: 2026, memberIds: [ID] }))
    expect(res.status).toBe(422)
    expect((await res.json()).blocked).toEqual(['대표자 성명이 없습니다.'])
  })
})
