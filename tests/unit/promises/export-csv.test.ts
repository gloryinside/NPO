import { describe, it, expect } from 'vitest'
import { clampDays } from '@/app/api/admin/promises/changes/export.csv/route'

describe('clampDays (G-114)', () => {
  it.each([
    ['30', 30],
    ['90', 90],
    ['180', 180],
    ['365', 365],
  ])('허용값 %s → %s', (input, expected) => {
    expect(clampDays(input)).toBe(expected)
  })

  it.each([
    [null, 180],
    ['', 180],
    ['0', 180],
    ['7', 180],
    ['9999', 180],
    ['abc', 180],
    ['180.5', 180],
  ])('잘못된 %j → fallback 180', (input, expected) => {
    expect(clampDays(input)).toBe(expected)
  })
})
