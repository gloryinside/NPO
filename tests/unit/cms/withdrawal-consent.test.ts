import { describe, it, expect } from 'vitest'
import { parseConsentInput } from '@/lib/cms/withdrawal-consent'

const now = new Date('2026-10-17T03:00:00Z')
const base = { method: 'paper', payerName: '김후원', payerRelation: 'self', consentedAt: '2026-10-16' }

describe('출금동의 입력', () => {
  it('계좌번호는 끝 4자리만 남긴다', () => {
    const r = parseConsentInput({ ...base, bankName: '국민은행', account: '123-45-678901' }, now)
    expect(r.ok && r.value.accountLast4).toBe('8901')
    expect(r.ok && r.value.bankName).toBe('국민은행')
    expect(JSON.stringify(r)).not.toContain('678901')
  })

  it('필수 항목과 형식을 확인한다', () => {
    expect(parseConsentInput({ ...base, method: 'email' }, now).ok).toBe(false)
    expect(parseConsentInput({ ...base, payerName: ' ' }, now).ok).toBe(false)
    expect(parseConsentInput({ ...base, payerRelation: 'friend' }, now).ok).toBe(false)
    expect(parseConsentInput({ ...base, account: '12' }, now).ok).toBe(false)
    expect(parseConsentInput({ ...base, consentedAt: 'yesterday' }, now).ok).toBe(false)
    expect(parseConsentInput({ ...base, consentedAt: '2026-10-20' }, now).ok).toBe(false)
  })

  it('관계를 비우면 본인으로 본다', () => {
    const r = parseConsentInput({ method: 'ars_recording', payerName: '이부모', consentedAt: '2026-10-01' }, now)
    expect(r.ok && r.value.payerRelation).toBe('self')
    expect(r.ok && r.value.accountLast4).toBeNull()
  })
})
