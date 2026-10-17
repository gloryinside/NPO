import { describe, it, expect } from 'vitest'
import { parseBirthDate, parseDonorProfile, profileColumns } from '@/lib/donations/donor-profile'

const today = new Date('2026-10-17T00:00:00Z')

describe('후원 신청서 생년월일·주소', () => {
  it('생년월일은 실제 날짜이고 미래가 아니어야 한다', () => {
    expect(parseBirthDate('1990-01-31', today)).toBe('1990-01-31')
    expect(parseBirthDate('', today)).toBeNull()
    expect(parseBirthDate(undefined, today)).toBeNull()
    expect(parseBirthDate('1990-02-30', today)).toBe('invalid')
    expect(parseBirthDate('2027-01-01', today)).toBe('invalid')
    expect(parseBirthDate('1899-12-31', today)).toBe('invalid')
    expect(parseBirthDate('19900131', today)).toBe('invalid')
  })

  it('주소를 정리하고 우편번호 형식을 확인한다', () => {
    const r = parseDonorProfile({ birthDate: '1990-01-31', postalCode: '04524', addressLine1: '  서울 중구   명동길 1 ', addressLine2: '101호' }, today)
    expect(r).toEqual({
      ok: true,
      value: { birthDate: '1990-01-31', postalCode: '04524', addressLine1: '서울 중구 명동길 1', addressLine2: '101호', joinPath: null, donorType: 'individual', businessNo: null },
    })
    expect(parseDonorProfile({ postalCode: '12' }, today).ok).toBe(false)
    expect(parseDonorProfile({ birthDate: 'x' }, today).ok).toBe(false)
  })

  it('기본 주소 없이 상세 주소만 오면 버린다', () => {
    const r = parseDonorProfile({ addressLine2: '101호' }, today)
    expect(r.ok && r.value.addressLine2).toBeNull()
  })

  it('새 후원자에 쓸 컬럼 이름', () => {
    expect(profileColumns({ birthDate: '1990-01-31', postalCode: null, addressLine1: 'a', addressLine2: null, joinPath: 'SNS', donorType: 'individual', businessNo: null })).toEqual({
      birth_date: '1990-01-31', postal_code: null, address_line1: 'a', address_line2: null, join_path: 'SNS', member_type: 'individual',
    })
  })

  it('기업 후원자는 사업자등록번호를 검증하고 생년월일은 받지 않는다', () => {
    const ok = parseDonorProfile({ donorType: 'corporate', businessNo: '104-82-11111', birthDate: '1990-01-31' }, today)
    expect(ok.ok && ok.value).toMatchObject({ donorType: 'corporate', businessNo: '1048211111', birthDate: null })
    expect(parseDonorProfile({ donorType: 'corporate', businessNo: '104-82-11112' }, today).ok).toBe(false)
    // 개인이 사업자번호를 보내도 쓰지 않는다
    const ind = parseDonorProfile({ businessNo: '1048211111' }, today)
    expect(ind.ok && ind.value.businessNo).toBeNull()
  })

  it('가입 경로는 정해진 선택지만 받는다', () => {
    expect(parseDonorProfile({ joinPath: 'SNS' }, today)).toMatchObject({ ok: true, value: { joinPath: 'SNS' } })
    const bad = parseDonorProfile({ joinPath: '<b>x</b>' }, today)
    expect(bad.ok && bad.value.joinPath).toBeNull()
  })
})
