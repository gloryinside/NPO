import { describe, it, expect, afterEach } from 'vitest'
import { ageOn, consentRows, parseDonationConsents, UNDER_14_MESSAGE } from '@/lib/legal/consent'
import { adBodyLimit, composeAdSms, isAdQuietHours, SMS_MAX } from '@/lib/legal/ad-message'
import { parseOfficer, readOfficer } from '@/lib/legal/privacy-settings'
import { activeProcessors, isStoredOverseas } from '@/lib/legal/processors'
import { defaultPrivacyPolicy } from '@/lib/legal/default-templates'

describe('후원 신청 동의', () => {
  const all = { terms: true, privacy: true, over14: true, marketing: false }
  it('필수 3가지(약관·수집이용·만 14세 이상)가 없으면 받지 않는다', () => {
    expect(parseDonationConsents(all, null, '2026-10-18')).toEqual({ ok: true, value: all })
    expect(parseDonationConsents({ ...all, privacy: false }, null, '2026-10-18').ok).toBe(false)
    expect(parseDonationConsents({ ...all, over14: false }, null, '2026-10-18')).toEqual({ ok: false, error: UNDER_14_MESSAGE })
    expect(parseDonationConsents(undefined, null, '2026-10-18').ok).toBe(false)
    // 문자열 'true' 같은 값은 동의로 보지 않는다
    expect(parseDonationConsents({ ...all, terms: 'true' }, null, '2026-10-18').ok).toBe(false)
  })
  it('생년월일이 만 14세 미만이면 체크해도 받지 않는다', () => {
    expect(parseDonationConsents(all, '2012-10-19', '2026-10-18').ok).toBe(false)
    expect(parseDonationConsents(all, '2012-10-18', '2026-10-18').ok).toBe(true)
  })
  it('만 나이', () => {
    expect(ageOn('2000-02-29', '2026-02-28')).toBe(25)
    expect(ageOn('2000-02-29', '2026-03-01')).toBe(26)
  })
  it('동의 기록은 항목마다 한 줄, 주민번호는 받은 경우만', () => {
    const rows = consentRows({ orgId: 'o', memberId: 'm', paymentId: 'p', consents: { ...all, marketing: true }, rrn: true, source: 'donation_form' })
    expect(rows.map((r) => `${r.kind}:${r.granted}`)).toEqual(['terms:true', 'privacy:true', 'over14:true', 'marketing:true', 'rrn:true'])
    expect(consentRows({ orgId: 'o', memberId: null, paymentId: null, consents: all, rrn: false, source: 'f2f' })).toHaveLength(4)
  })
})

describe('광고 문자', () => {
  it("'(광고)'·보내는 곳·무료 수신거부를 붙이고 90자 안에 맞춘다", () => {
    const sms = composeAdSms('희망재단', '02-123-4567', '이번 주 캠페인 안내')
    expect(sms).toBe('(광고)희망재단\n이번 주 캠페인 안내\n무료수신거부 02-123-4567')
    const limit = adBodyLimit('희망재단', '02-123-4567')
    expect(composeAdSms('희망재단', '02-123-4567', '가'.repeat(limit)).length).toBe(SMS_MAX)
  })
  it('밤 9시~아침 8시(한국 시간)는 보낼 수 없다', () => {
    expect(isAdQuietHours(new Date('2026-10-18T12:00:00Z'))).toBe(true) // 21:00 KST
    expect(isAdQuietHours(new Date('2026-10-17T22:59:00Z'))).toBe(true) // 07:59 KST
    expect(isAdQuietHours(new Date('2026-10-17T23:00:00Z'))).toBe(false) // 08:00 KST
    expect(isAdQuietHours(new Date('2026-10-18T11:59:00Z'))).toBe(false) // 20:59 KST
  })
})

describe('처리방침', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  it('보호책임자 — 이름과 연락처 하나는 필수', () => {
    expect(parseOfficer({ name: '김보호', email: 'p@org.kr' }).ok).toBe(true)
    expect(parseOfficer({ name: '김보호' }).ok).toBe(false)
    expect(parseOfficer({ name: '김보호', email: 'x' }).ok).toBe(false)
    expect(readOfficer({ officer: { name: ' 김보호 ', phone: '02-1' } })).toEqual({ name: '김보호', title: null, phone: '02-1', email: null })
    expect(readOfficer(null)).toBeNull()
  })

  it('저장 위치가 국내가 아니거나 모르면 국외 이전으로 고지한다', () => {
    expect(isStoredOverseas(null)).toBe(true)
    expect(isStoredOverseas('호주(시드니, AWS ap-southeast-2)')).toBe(true)
    expect(isStoredOverseas('대한민국(서울, AWS ap-northeast-2)')).toBe(false)
  })

  it('쓰는 서비스만 위탁 대상으로 싣는다', () => {
    const names = activeProcessors({ RESEND_API_KEY: 'x' } as unknown as NodeJS.ProcessEnv).map((p) => p.name)
    expect(names).toContain('Resend, Inc.')
    expect(names).not.toContain('NHN Cloud㈜')
  })

  it('필수 기재사항이 모두 들어간다', () => {
    process.env.DATA_STORAGE_LOCATION = '호주(시드니, AWS ap-southeast-2)'
    const md = defaultPrivacyPolicy({
      orgName: '희망재단', contactEmail: 'a@b.kr', officer: { name: '김보호', email: 'p@b.kr' }, processors: activeProcessors({} as unknown as NodeJS.ProcessEnv),
    })
    for (const h of ['처리 목적', '처리하는 개인정보 항목', '보유 기간', '제3자 제공', '처리의 위탁', '국외 이전', '자동 수집 장치', '만 14세 미만', '파기', '권리', '안전성 확보', '보호책임자', '권익침해 구제', '변경']) {
      expect(md).toContain(h)
    }
    expect(md).toContain('호주(시드니, AWS ap-southeast-2)')
    expect(md).toContain('김보호')
    expect(defaultPrivacyPolicy({ orgName: 'x' })).toContain('지정 필요')
  })
})
