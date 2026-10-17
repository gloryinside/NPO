import { describe, it, expect } from 'vitest'
import { isPickable, reservationUntil, toPublicChild } from '@/lib/sponsorship/pick'
import { parseLetterText, toDonorLetters, LETTER_MAX } from '@/lib/sponsorship/letters'

const row = {
  id: 'b1', code: 'KR-2026-0042', name: '김민지', birth_year: 2016, gender: 'female',
  region: '서울 강북', bio: '그림 그리기를 좋아해요.', photo_url: 'https://cdn.example.org/a.jpg',
}

describe('결연 아동 공개 정보', () => {
  it('이름은 성만, 나이와 광역 지역만 보인다', () => {
    expect(toPublicChild(row, 2026)).toEqual({
      id: 'b1', code: 'KR-2026-0042', displayName: '김○○', age: 10, gender: '여자아이',
      region: '서울', bio: '그림 그리기를 좋아해요.', photoUrl: 'https://cdn.example.org/a.jpg',
    })
  })

  it('https 가 아닌 사진 주소는 쓰지 않는다', () => {
    expect(toPublicChild({ ...row, photo_url: 'javascript:alert(1)' }, 2026).photoUrl).toBeNull()
    expect(toPublicChild({ ...row, photo_url: 'http://x.org/a.jpg' }, 2026).photoUrl).toBeNull()
    expect(toPublicChild({ ...row, photo_url: null, birth_year: null, gender: null }, 2026)).toMatchObject({ photoUrl: null, age: null, gender: null })
  })

  it('공개·결연 가능·잡아 둔 기한이 없거나 지난 아이만 고를 수 있다', () => {
    const now = new Date('2026-10-18T00:00:00Z')
    expect(isPickable({ status: 'available', public_listing: true, reserved_until: null }, now)).toBe(true)
    expect(isPickable({ status: 'available', public_listing: true, reserved_until: '2026-10-17T00:00:00Z' }, now)).toBe(true)
    expect(isPickable({ status: 'available', public_listing: true, reserved_until: '2026-10-19T00:00:00Z' }, now)).toBe(false)
    expect(isPickable({ status: 'available', public_listing: false, reserved_until: null }, now)).toBe(false)
    expect(isPickable({ status: 'sponsored', public_listing: true, reserved_until: null }, now)).toBe(false)
  })

  it('카드는 하루, 자동이체·계좌이체는 7일 잡아 둔다', () => {
    const now = new Date('2026-10-18T00:00:00Z')
    expect(reservationUntil(false, now)).toBe('2026-10-19T00:00:00.000Z')
    expect(reservationUntil(true, now)).toBe('2026-10-25T00:00:00.000Z')
  })

  it('지역은 첫 낱말만', () => {
    expect(toPublicChild({ ...row, region: '  경기 수원시 장안구 정자동 ' }, 2026).region).toBe('경기')
    expect(toPublicChild({ ...row, region: null }, 2026).region).toBeNull()
  })
})

describe('결연 편지', () => {
  it('길이를 확인하고 제어 문자를 지운다', () => {
    expect(parseLetterText('안녕, 잘 지내니? 보고 싶어.')).toEqual({ ok: true, text: '안녕, 잘 지내니? 보고 싶어.' })
    expect(parseLetterText('짧아')).toMatchObject({ ok: false })
    expect(parseLetterText('가'.repeat(LETTER_MAX + 1))).toMatchObject({ ok: false })
    expect(parseLetterText(42)).toMatchObject({ ok: false })
    expect(parseLetterText('첫 줄\r\n둘째 줄\u0007 입니다')).toEqual({ ok: true, text: '첫 줄\n둘째 줄 입니다' })
  })

  it('아이 편지는 전달된 것만, 번역본이 있으면 번역본을 보여 준다', () => {
    const base = { rejection_reason: null, created_at: '2026-10-01T00:00:00Z', delivered_at: null }
    const out = toDonorLetters([
      { ...base, id: '1', direction: 'to_sponsor', original_text: 'Hello', translated_text: '안녕하세요', status: 'delivered', delivered_at: '2026-10-02T00:00:00Z' },
      { ...base, id: '2', direction: 'to_sponsor', original_text: '검토 전', translated_text: null, status: 'received' },
      { ...base, id: '3', direction: 'to_beneficiary', original_text: '내 편지', translated_text: null, status: 'rejected', rejection_reason: '연락처 포함' },
    ])
    expect(out).toEqual([
      { id: '1', fromMe: false, text: '안녕하세요', statusLabel: null, note: null, date: '2026-10-02T00:00:00Z' },
      { id: '3', fromMe: true, text: '내 편지', statusLabel: '전달하지 못함', note: '연락처 포함', date: '2026-10-01T00:00:00Z' },
    ])
  })
})
