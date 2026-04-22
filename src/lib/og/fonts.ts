import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700 }

let cached: OgFont[] | null = null

/**
 * Noto Sans KR Regular/Bold 폰트를 로드한다. 모듈 life-cycle 내 1회만 디스크 I/O.
 * 로드 실패 시 null — ImageResponse 호출부는 `fonts` 옵션 생략으로 graceful fallback.
 */
export async function loadKoreanFonts(): Promise<OgFont[] | null> {
  if (cached) return cached
  try {
    const base = path.join(process.cwd(), 'public', 'fonts')
    const [regular, bold] = await Promise.all([
      readFile(path.join(base, 'NotoSansKR-Regular.ttf')),
      readFile(path.join(base, 'NotoSansKR-Bold.ttf')),
    ])
    cached = [
      {
        name: 'NotoSansKR',
        data: regular.buffer.slice(
          regular.byteOffset,
          regular.byteOffset + regular.byteLength,
        ) as ArrayBuffer,
        weight: 400,
      },
      {
        name: 'NotoSansKR',
        data: bold.buffer.slice(
          bold.byteOffset,
          bold.byteOffset + bold.byteLength,
        ) as ArrayBuffer,
        weight: 700,
      },
    ]
    return cached
  } catch (err) {
    console.warn('[og] Korean font load failed, using fallback:', err)
    return null
  }
}
