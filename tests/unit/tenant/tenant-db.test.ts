import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
import { tenantDb, TENANT_TABLES } from '@/lib/tenant/db'

const ORG = '8ca9a653-f788-450d-a114-ac336e11f94d'

function recorder() {
  const calls: Array<[string, unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq']) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, args])
      return q
    }
  }
  const client = { from: (t: string) => (calls.push(['from', [t]]), q) } as unknown as SupabaseClient
  return { client, calls }
}

describe('tenantDb — 기관 조건 강제', () => {
  it('select·update·delete에 org_id 조건', () => {
    const { client, calls } = recorder()
    const db = tenantDb(ORG, client)
    db.select('members', 'id')
    db.update('members', { name: 'x' })
    db.delete('members')
    expect(calls.filter(([m]) => m === 'eq')).toEqual([
      ['eq', ['org_id', ORG]],
      ['eq', ['org_id', ORG]],
      ['eq', ['org_id', ORG]],
    ])
  })

  it('[보안] insert는 호출부가 넣은 다른 기관 org_id를 덮어쓴다', () => {
    const { client, calls } = recorder()
    tenantDb(ORG, client).insert('members', { name: 'x', org_id: '11111111-1111-1111-1111-111111111111' })
    expect(calls.find(([m]) => m === 'insert')![1][0]).toEqual([{ name: 'x', org_id: ORG }])
  })

  it('[보안] update 패치에서 org_id를 지운다(다른 기관으로 이동 불가)', () => {
    const { client, calls } = recorder()
    tenantDb(ORG, client).update('payments', { amount: 1, org_id: '11111111-1111-1111-1111-111111111111' })
    expect(calls.find(([m]) => m === 'update')![1][0]).toEqual({ amount: 1 })
  })

  it('org_id 없는 테이블·잘못된 orgId는 즉시 오류', () => {
    const { client } = recorder()
    expect(() => tenantDb(ORG, client).select('orgs' as never)).toThrow(/org_id가 있는 테이블이 아닙니다/)
    expect(() => tenantDb("x' or 1=1", client)).toThrow(/UUID/)
  })
})

describe('TENANT_TABLES ↔ 마이그레이션 동기화', () => {
  it('org_id 컬럼이 있는 모든 테이블이 목록에 있다', () => {
    const dir = join(process.cwd(), 'supabase/migrations')
    const found = new Set<string>()
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      const s = readFileSync(join(dir, f), 'utf8')
      for (const m of s.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/gi)) {
        if (/\borg_id\s+uuid/i.test(m[2])) found.add(m[1].toLowerCase())
      }
      for (const m of s.matchAll(/alter table (?:if exists )?(?:public\.)?([a-z_]+)\s+add column (?:if not exists )?org_id\b/gi)) {
        found.add(m[1].toLowerCase())
      }
    }
    const listed = new Set<string>(TENANT_TABLES)
    expect([...found].filter((t) => !listed.has(t))).toEqual([])
  })
})
