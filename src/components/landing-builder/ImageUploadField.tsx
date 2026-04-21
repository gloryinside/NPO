'use client'

/**
 * 랜딩 섹션 공용 이미지 업로드 필드
 *
 * - 파일 선택 → POST /api/admin/org/landing/images → public URL을 value로 설정
 * - URL 직접 입력도 허용 (외부 이미지 hotlink 가능)
 * - 업로드 중 파일 선택 버튼 disabled + 스피너
 * - 실패 시 sonner toast
 *
 * 재사용: Hero(bgValue), Impact(imageUrl), Team(photoUrl), DonationTiers(필요시)
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'

interface Props {
  value: string
  onChange: (url: string) => void
  placeholder?: string
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export function ImageUploadField({ value, onChange, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/org/landing/images', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: '업로드 실패' }))) as { error?: string }
        throw new Error(error ?? '업로드 실패')
      }
      const { url } = (await res.json()) as { url: string }
      onChange(url)
      toast.success('이미지가 업로드되었습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className={`${inputCls} flex-1`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://... 또는 아래 업로드'}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-border px-3 py-2 text-xs whitespace-nowrap hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {uploading ? '업로드 중…' : '📎 파일'}
        </button>
      </div>
      {value && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt="미리보기"
          className="max-h-32 w-auto rounded-lg border border-border object-contain bg-muted"
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
