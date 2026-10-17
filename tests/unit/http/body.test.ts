import { describe, it, expect } from 'vitest'
import { readJsonObject } from '@/lib/http/body'

const req = (body: string) => new Request('http://x/api', { method: 'POST', body })

describe('readJsonObject', () => {
  it('JSON 객체는 그대로', async () => {
    const r = await readJsonObject<{ a: number }>(req('{"a":1}'))
    expect(r.ok && r.body.a).toBe(1)
  })
  it.each(['not json', 'null', '[1,2]', '42', '"s"', ''])('객체가 아니면 400: %s', async (b) => {
    const r = await readJsonObject(req(b))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })
})
