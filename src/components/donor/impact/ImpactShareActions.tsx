'use client'
import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  availableYears: number[]
  /** 공유 이미지 경로 — /api/donor/impact/og */
  ogPath?: string
}

/**
 * Phase 5-A: PDF 다운로드 + 소셜 공유 버튼 세트.
 */
export function ImpactShareActions({ availableYears, ogPath = '/api/donor/impact/og' }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [year, setYear] = useState<number>(0)  // 0 = 전체

  async function downloadPdf() {
    setDownloading(true)
    try {
      const url = year > 0 ? `/api/donor/impact/pdf?year=${year}` : '/api/donor/impact/pdf'
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string })?.error ?? 'PDF 생성 실패')
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = year > 0 ? `impact-${year}.pdf` : 'impact-all.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success('리포트가 다운로드되었습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF 다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  function shareImage() {
    const absoluteUrl = `${window.location.origin}${ogPath}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(absoluteUrl).then(
        () => toast.success('이미지 링크가 클립보드에 복사되었습니다.'),
        () => toast.error('복사 실패'),
      )
    } else {
      toast.info(`이미지 URL: ${absoluteUrl}`)
    }
  }

  function openImagePreview() {
    window.open(ogPath, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">리포트·공유</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">연간 리포트를 PDF로 받거나, SNS용 공유 카드를 받으실 수 있어요.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* PDF */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">📄 연간 리포트 PDF</div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">선택한 기간의 후원 내역을 PDF로 저장합니다.</p>
          </div>
          <div className="flex gap-2">
            <select
              title="연도 선택"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value={0}>전체 기간</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {downloading ? '생성 중…' : '다운로드'}
            </button>
          </div>
        </div>

        {/* 공유 카드 */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">🌐 공유 카드</div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">이름은 마스킹되어 공개돼요. SNS에 올리거나 친구에게 공유해보세요.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openImagePreview}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] py-2 text-sm hover:border-[var(--accent)]"
            >
              미리보기
            </button>
            <button
              type="button"
              onClick={shareImage}
              className="rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              링크 복사
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
