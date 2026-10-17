import { describe, it, expect, vi } from 'vitest'
import { addDays, anniversaryDays, fullYears, kstDayRange } from '@/lib/journey/dates'
import { fillText, renderJourneyEmail } from '@/lib/journey/render'
import { effectiveSteps, stepDef } from '@/lib/journey/steps'
import { eligible, runJourneyForOrg } from '@/lib/journey/runner'

describe('여정 메시지 날짜', () => {
  it('날짜 더하기와 KST 하루 범위', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(kstDayRange('2026-10-16')).toEqual({ from: '2026-10-16T00:00:00+09:00', to: '2026-10-17T00:00:00+09:00' })
  })

  it('평년 2/28에는 2/29생도 챙긴다', () => {
    expect(anniversaryDays('2027-02-28')).toEqual({ month: 2, days: [28, 29] })
    expect(anniversaryDays('2028-02-28')).toEqual({ month: 2, days: [28] })
    expect(anniversaryDays('2026-10-17')).toEqual({ month: 10, days: [17] })
  })

  it('꽉 찬 햇수', () => {
    expect(fullYears('2024-10-17', '2026-10-17')).toBe(2)
    expect(fullYears('2024-10-18', '2026-10-17')).toBe(1)
    expect(fullYears('2024-02-29', '2025-02-28')).toBe(1)
  })
})

describe('여정 메시지 문구', () => {
  it('변수를 채우고 모르는 변수는 그대로 둔다', () => {
    expect(fillText('{{이름}}님 {{ 금액 }} {{없음}}', { 이름: '김후원', 금액: '30,000원' })).toBe('김후원님 30,000원 {{없음}}')
  })

  it('이름·문구에 든 HTML은 실행되지 않게 바꾸고, 주소는 링크로', () => {
    const r = renderJourneyEmail(
      { subject: '{{이름}}님\n안녕', body: '<b>굵게</b> {{이름}}\n\n{{마이페이지}}' },
      { 이름: '<script>x</script>', 마이페이지: 'https://hope.example.org/donor' },
      { orgName: '희망&나눔', settingsUrl: 'https://hope.example.org/donor/settings' },
    )
    expect(r.subject).toBe('<script>x</script>님 안녕')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;b&gt;굵게&lt;/b&gt;')
    expect(r.html).toContain('<a href="https://hope.example.org/donor"')
    expect(r.html).toContain('희망&amp;나눔')
    expect(r.html).toContain('알림 설정')
  })
})

describe('단계 설정', () => {
  it('저장하지 않은 단계는 기본값 — 첫 후원 감사만 켜져 있다', () => {
    const s = effectiveSteps([])
    expect(s.filter((x) => x.enabled).map((x) => x.key)).toEqual(['thanks_30d'])
    expect(s.every((x) => !x.customized)).toBe(true)
  })

  it('저장한 값이 기본값보다 우선', () => {
    const s = effectiveSteps([{ step_key: 'birthday', enabled: true, channel: 'email', subject: '축하', body: '본문' }])
    const b = s.find((x) => x.key === 'birthday')!
    expect([b.enabled, b.subject, b.customized]).toEqual([true, '축하', true])
  })

  it('받을 수 있는 후원자', () => {
    const base = { id: 'm', name: 'a', email: 'a@x.kr', email_disabled: false, marketing_consent: false, notification_prefs: {}, status: 'active' }
    const intro = stepDef('intro_d7')!
    const thanks = stepDef('thanks_30d')!
    expect(eligible(base, thanks)).toBe(true)
    expect(eligible(base, intro)).toBe(false)
    expect(eligible({ ...base, marketing_consent: true }, intro)).toBe(true)
    expect(eligible({ ...base, email_disabled: true }, thanks)).toBe(false)
    expect(eligible({ ...base, status: 'deceased' }, thanks)).toBe(false)
    expect(eligible({ ...base, notification_prefs: { journey: false } }, thanks)).toBe(false)
    expect(eligible({ ...base, email: null }, thanks)).toBe(false)
  })
})

/** 실행기용 작은 메모리 DB — 이 테스트에 필요한 필터만 */
type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>, rpc: Record<string, Row[]> = {}) {
  let seq = 0
  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: Row | null = null
    const rows = () => (tables[table] ??= [])
    const run = (): { data: unknown; error: { code: string } | null } => {
      if (op === 'insert') {
        const r: Row = { id: `${table}-${++seq}`, ...payload! }
        if (table === 'journey_sends') {
          const dup = rows().some((x) => ['org_id', 'step_key', 'member_id', 'period_key'].every((k) => x[k] === r[k]))
          if (dup) return { data: null, error: { code: '23505' } }
        }
        rows().push(r)
        return { data: [r], error: null }
      }
      const hit = rows().filter((r) => filters.every((f) => f(r)))
      if (op === 'update') hit.forEach((r) => Object.assign(r, payload))
      return { data: hit, error: null }
    }
    const q = {
      select: () => q,
      insert: (p: Row) => ((op = 'insert'), (payload = p), q),
      update: (p: Row) => ((op = 'update'), (payload = p), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      not: (k: string) => (filters.push((r) => r[k] != null), q),
      gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), q),
      lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), q),
      limit: () => q,
      maybeSingle: async () => {
        const { data, error } = run()
        return { data: error ? null : ((data as Row[])[0] ?? null), error }
      },
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    }
    return q
  }
  return {
    client: { from, rpc: async (name: string) => ({ data: rpc[name] ?? [], error: null }) } as never,
    tables,
  }
}

describe('여정 메시지 실행', () => {
  const org = { id: 'o1', name: '희망나눔', slug: 'hope' }
  const member = (id: string, extra: Row = {}) => ({
    id, org_id: 'o1', name: `후원자${id}`, email: `${id}@x.kr`, email_disabled: false,
    marketing_consent: false, notification_prefs: {}, status: 'active', ...extra,
  })

  function seed() {
    return fakeDb({
      journey_steps: [{ org_id: 'o1', step_key: 'birthday', enabled: true, channel: 'email', subject: '{{이름}}님 생일 축하', body: '축하해요' }],
      members: [member('m1'), member('m2'), member('m3', { email_disabled: true })],
      payments: [
        { org_id: 'o1', member_id: 'm1', amount: 30000, pay_status: 'paid', pay_date: '2026-09-17' },
        { org_id: 'o1', member_id: 'm2', amount: 10000, pay_status: 'paid', pay_date: '2026-09-17' },
        { org_id: 'o1', member_id: 'm2', amount: 10000, pay_status: 'paid', pay_date: '2026-08-17' },
      ],
      journey_sends: [],
      notification_log: [],
    }, { journey_birthday_members: [{ id: 'm1' }, { id: 'm3' }] })
  }

  it('켜진 단계만, 받을 수 있는 사람에게 한 번씩 보낸다', async () => {
    const { client, tables } = seed()
    const send = vi.fn().mockResolvedValue({ success: true })
    const report = await runJourneyForOrg(client, org, { today: '2026-10-17', send })

    // 첫 후원 감사(기본 켜짐): m1만 — m2는 8월에 먼저 후원했다
    expect(report.find((r) => r.step === 'thanks_30d')).toMatchObject({ targets: 1, sent: 1 })
    // 생일: m1 발송, m3는 반송으로 막혀 건너뜀
    expect(report.find((r) => r.step === 'birthday')).toMatchObject({ targets: 2, sent: 1, skipped: 1 })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.map((c) => c[0].subject)).toContain('후원자m1님 생일 축하')
    expect(tables.journey_sends.map((s) => `${s.step_key}:${s.member_id}:${s.period_key}`).sort()).toEqual([
      'birthday:m1:2026',
      'thanks_30d:m1:once',
    ])
  })

  it('같은 날 다시 돌아도 두 번 보내지 않는다', async () => {
    const { client } = seed()
    const send = vi.fn().mockResolvedValue({ success: true })
    await runJourneyForOrg(client, org, { today: '2026-10-17', send })
    await runJourneyForOrg(client, org, { today: '2026-10-17', send })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('보내기에 실패하면 실패로 남긴다', async () => {
    const { client, tables } = seed()
    const send = vi.fn().mockResolvedValue({ success: false, error: 'SMTP 설정 누락' })
    const report = await runJourneyForOrg(client, org, { today: '2026-10-17', send })
    expect(report.reduce((n, r) => n + r.failed, 0)).toBe(2)
    expect(tables.journey_sends.every((s) => s.status === 'failed' && s.error === 'SMTP 설정 누락')).toBe(true)
  })

  it('예전 감사 편지를 받은 후원자는 다시 받지 않는다', async () => {
    const { client, tables } = seed()
    tables.notification_log.push({ org_id: 'o1', template: 'thank_you_letter_30d', ref_key: 'm1' })
    const send = vi.fn().mockResolvedValue({ success: true })
    const report = await runJourneyForOrg(client, org, { today: '2026-10-17', send })
    expect(report.find((r) => r.step === 'thanks_30d')).toMatchObject({ targets: 0, sent: 0 })
  })
})
