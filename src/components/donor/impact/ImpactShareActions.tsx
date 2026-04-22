'use client'
import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  availableYears: number[]
  /** 공유 이미지 경로 — /api/donor/impact/og */
  ogPath?: string
  /**
   * G-120: OG 카드의 natural cache invalidation 키. 마지막 결제일(ISO) —
   * 새 결제가 들어오면 이 값이 바뀌어 ?v= 쿼리가 갱신 → 브라우저/엣지 캐시
   * 자연 무효화. null이면 ?v= 생략(결제 없음 = 캐시 고려 불필요).
   */
  cacheVersion?: string | null
}

/**
 * G-120: OG 경로에 버전 쿼리를 붙여 자연 캐시 무효화. cacheVersion이 null이면
 * 원 경로 그대로(결제 없음 = 캐시 의미 없음). URL-safe encoding 보장.
 *
 * 주의: ogPath에 이미 query string이 있을 수 있으므로 '?' vs '&' 분기.
 */
export function buildVersionedOgPath(
  ogPath: string,
  cacheVersion: string | null | undefined,
): string {
  if (!cacheVersion) return ogPath
  const sep = ogPath.includes('?') ? '&' : '?'
  return `${ogPath}${sep}v=${encodeURIComponent(cacheVersion)}`
}

/**
 * Phase 5-A: PDF 다운로드 + 소셜 공유 버튼 세트.
 */
export function ImpactShareActions({
  availableYears,
  ogPath = '/api/donor/impact/og',
  cacheVersion = null,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [year, setYear] = useState<number>(0)  // 0 = 전체

  const versionedOgPath = buildVersionedOgPath(ogPath, cacheVersion)

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
    const absoluteUrl = `${window.location.origin}${versionedOgPath}`
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
    window.open(versionedOgPath, '_blank', 'noopener,noreferrer')
  }

  /**
   * G-119: 공유 카드를 로컬 파일로 저장. fetch → blob → <a download>.
   * 이름 마스킹은 서버에서 이미 적용된 상태라 그대로 저장해도 안전.
   */
  async function saveImage() {
    setSavingImage(true)
    try {
      const res = await fetch(versionedOgPath, { cache: 'no-store' })
      if (!res.ok) {
        toast.error('이미지를 불러오지 못했습니다.')
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = 'impact-card.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success('이미지가 저장되었습니다.')
    } catch {
      toast.error('이미지 저장 실패')
    } finally {
      setSavingImage(false)
    }
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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={openImagePreview}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] py-2 text-sm hover:border-[var(--accent)]"
            >
              미리보기
            </button>
            <button
              type="button"
              onClick={saveImage}
              disabled={savingImage}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] py-2 text-sm hover:border-[var(--accent)] disabled:opacity-50"
            >
              {savingImage ? '저장 중…' : '이미지 저장'}
            </button>
            <button
              type="button"
              onClick={shareImage}
              className="rounded-md py-2 text-sm font-medium text-white"
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
