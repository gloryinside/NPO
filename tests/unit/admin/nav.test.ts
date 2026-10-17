import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ADMIN_NAV, ALL_NAV_ITEMS, activeNavHref, hubOfHref, searchNav } from '@/lib/admin/nav'

describe('관리자 메뉴 구조', () => {
  it('모든 메뉴는 실제 페이지가 있다(죽은 링크 없음)', () => {
    const missing = ALL_NAV_ITEMS.filter(
      (it) => !fs.existsSync(path.join(process.cwd(), 'src/app/(admin)', it.href, 'page.tsx')),
    ).map((it) => it.href)
    expect(missing).toEqual([])
  })

  it('메뉴 주소는 중복되지 않는다', () => {
    const hrefs = ALL_NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('허브는 6개, 허브마다 주요 메뉴는 4개 이하로 짧게', () => {
    expect(ADMIN_NAV).toHaveLength(6)
    for (const hub of ADMIN_NAV) {
      const primary = hub.items.filter((i) => i.primary).length
      expect(primary).toBeGreaterThan(0)
      expect(primary).toBeLessThanOrEqual(4)
    }
  })
})

describe('현재 위치', () => {
  it('하위 경로도 그 메뉴로 — 여럿 맞으면 가장 길게 맞는 것', () => {
    expect(activeNavHref('/admin/members/123')).toBe('/admin/members')
    expect(activeNavHref('/admin/members/duplicates')).toBe('/admin/members/duplicates')
    expect(activeNavHref('/admin/promises/changes')).toBe('/admin/promises/changes')
    expect(activeNavHref('/admin/campaigns/abc/edit')).toBe('/admin/campaigns')
  })
  it('대시보드는 정확히 /admin일 때만', () => {
    expect(activeNavHref('/admin')).toBe('/admin')
    expect(activeNavHref('/admin/unknown-page')).toBeNull()
  })
  it('메뉴 → 허브', () => {
    expect(hubOfHref('/admin/receipts')).toBe('giving')
    expect(hubOfHref(null)).toBeNull()
  })
})

describe('메뉴 검색', () => {
  it('이름 앞부분 일치가 먼저', () => {
    expect(searchNav('미납')[0].href).toBe('/admin/unpaid')
  })
  it('동의어로도 찾는다', () => {
    expect(searchNav('연말정산').map((r) => r.href)).toContain('/admin/receipts')
    expect(searchNav('차지백').map((r) => r.href)).toContain('/admin/chargebacks')
  })
  it('공백·대소문자 무시, 빈 검색어는 결과 없음', () => {
    expect(searchNav('erp').length).toBeGreaterThan(0)
    expect(searchNav('  ')).toEqual([])
  })
})

describe('하는 일로 찾기(비전문가)', () => {
  it('작업 문구로 화면을 찾는다', () => {
    expect(searchNav('영수증 발급')[0].href).toBe('/admin/receipts')
    expect(searchNav('직원 초대')[0].href).toBe('/admin/users')
    expect(searchNav('환불')[0].href).toBe('/admin/refund-approvals')
  })
  it('모든 메뉴는 한 줄 설명이 있다', () => {
    expect(ALL_NAV_ITEMS.filter((i) => !i.desc?.trim())).toEqual([])
  })
  it('메뉴 이름에 어려운 회계·영문 용어를 단독으로 쓰지 않는다', () => {
    const jargon = /^(약정 관리|납입 관리|미납 관리|수입결의|대사|UTM|LTV|CRM|Chargeback)/
    expect(ALL_NAV_ITEMS.map((i) => i.label).filter((l) => jargon.test(l))).toEqual([])
  })
})

describe('문장으로 찾기', () => {
  it('질문 문장에서도 맞는 화면을 찾는다(조사 떼기)', () => {
    expect(searchNav('연말에 영수증은 어떻게 보내요')[0].href).toBe('/admin/receipts')
    expect(searchNav('카드 결제가 실패했어요').map((r) => r.href)).toContain('/admin/unpaid')
    expect(searchNav('직원을 초대하고 싶어요')[0].href).toBe('/admin/users')
  })
})
