import { describe, it, expect } from 'vitest'
import { renderAmountChangeEmail } from '@/lib/promises/amount-change-email'

describe('renderAmountChangeEmail', () => {
  it('up: 증액 제목 + 금액 대비 배수 문구', () => {
    const r = renderAmountChangeEmail('up', {
      toEmail: 'a@a.com',
      memberName: '홍길동',
      orgName: '우리재단',
      campaignTitle: '아동교육',
      previousAmount: 10_000,
      newAmount: 20_000,
    })
    expect(r.subject).toContain('증액')
    expect(r.subject).toContain('우리재단')
    expect(r.html).toContain('10,000원')
    expect(r.html).toContain('20,000원')
    expect(r.html).toContain('아동교육')
  })

  it('up: 1.5배 이상이면 배수 문구 포함', () => {
    const r = renderAmountChangeEmail('up', {
      toEmail: 'a@a.com',
      memberName: '홍',
      orgName: '우리재단',
      campaignTitle: null,
      previousAmount: 10_000,
      newAmount: 30_000,
    })
    expect(r.html).toContain('3.0배')
  })

  it('down: 감사 톤 제목 + 유지 문구', () => {
    const r = renderAmountChangeEmail('down', {
      toEmail: 'a@a.com',
      memberName: '홍길동',
      orgName: '우리재단',
      campaignTitle: null,
      previousAmount: 30_000,
      newAmount: 10_000,
    })
    expect(r.subject).toContain('계속 함께')
    expect(r.html).toContain('30,000원')
    expect(r.html).toContain('10,000원')
    expect(r.html).not.toContain('증액')
  })

  it('HTML 이스케이프: 기관/멤버 이름에 특수문자 포함돼도 주입 안 됨', () => {
    const r = renderAmountChangeEmail('up', {
      toEmail: 'a@a.com',
      memberName: '<script>alert(1)</script>',
      orgName: '"A"&B',
      campaignTitle: '<b>evil</b>',
      previousAmount: 10_000,
      newAmount: 20_000,
    })
    expect(r.html).not.toContain('<script>alert(1)</script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.subject).not.toContain('"A"&B')
    expect(r.subject).toContain('&quot;A&quot;&amp;B')
  })

  it('memberName 빈 문자면 "후원자"로 fallback', () => {
    const r = renderAmountChangeEmail('up', {
      toEmail: 'a@a.com',
      memberName: '',
      orgName: 'Org',
      campaignTitle: null,
      previousAmount: 10_000,
      newAmount: 20_000,
    })
    expect(r.html).toContain('후원자')
  })
})
