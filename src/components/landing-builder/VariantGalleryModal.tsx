'use client'
import { useState } from 'react'
import type { LandingSectionType } from '@/types/landing'
import { getVariants } from '@/lib/landing-variants'
import '@/lib/landing-variants/register-all'
import type { VisualWeight } from '@/lib/landing-variants/types'

interface Props {
  type: LandingSectionType
  currentVariantId?: string
  onSelect: (variantId: string) => void
  onClose: () => void
}

const WEIGHT_LABEL: Record<VisualWeight, string> = {
  minimal: '미니멀',
  bold: '강조',
  cinematic: '시네마틱',
}

const WEIGHT_COLOR: Record<VisualWeight, string> = {
  minimal: 'var(--muted-foreground)',
  bold: 'var(--accent)',
  cinematic: 'var(--negative)',
}

export function VariantGalleryModal({ type, currentVariantId, onSelect, onClose }: Props) {
  const variants = getVariants(type)
  // G-72: variant 수가 6개 이상이면 첫 방문 시 'bold'로 필터링 (신규 섹션 추가)
  // 편집 모드(currentVariantId 존재)에서는 현재 variant의 weight로 초기화 — 유사 옵션부터 보임
  const initialFilter: 'all' | VisualWeight = (() => {
    if (currentVariantId) {
      const current = variants.find((v) => v.id === currentVariantId)
      if (current) return current.visualWeight
    }
    return variants.length >= 6 ? 'bold' : 'all'
  })()
  const [filter, setFilter] = useState<'all' | VisualWeight>(initialFilter)
  const filtered = filter === 'all' ? variants : variants.filter((v) => v.visualWeight === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-lg border flex flex-col overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Variant 선택</p>
            <h3 className="text-base font-semibold text-[var(--text)] mt-0.5">
              {type} · {variants.length}개 variants 중 선택
            </h3>
          </div>
          <button type="button" onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--text)] text-lg"
            aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="px-5 py-3 flex gap-2 border-b border-[var(--border)]">
          {(['all', 'minimal', 'bold', 'cinematic'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={{
                background: filter === k ? 'var(--accent)' : 'var(--surface-2)',
                color: filter === k ? '#fff' : 'var(--muted-foreground)',
                borderColor: filter === k ? 'var(--accent)' : 'var(--border)',
              }}>
              {k === 'all' ? '전체' : WEIGHT_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-[var(--muted-foreground)]">
              해당 조건의 variant가 없습니다.
            </div>
          )}
          {filtered.map((v) => {
            const active = v.id === currentVariantId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className="text-left rounded-lg border overflow-hidden transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  boxShadow: active
                    ? '0 0 0 3px color-mix(in oklch, var(--accent), transparent 70%)'
                    : 'var(--shadow-card)',
                }}>
                <div className="aspect-[3/2] bg-[var(--bg)] flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.preview.replace(/\.svg$/, '.png')}
                    alt={v.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // PNG 없으면 SVG로 폴백, SVG도 없으면 숨김 (G-73)
                      const img = e.target as HTMLImageElement
                      if (img.src.endsWith('.png')) {
                        img.src = v.preview
                      } else {
                        img.style.display = 'none'
                      }
                    }}
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--text)]">{v.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: `color-mix(in oklch, ${WEIGHT_COLOR[v.visualWeight]}, transparent 85%)`,
                        color: WEIGHT_COLOR[v.visualWeight],
                      }}>
                      {WEIGHT_LABEL[v.visualWeight]}
                    </span>
                    {active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--accent)] text-white">
                        현재
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{v.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
