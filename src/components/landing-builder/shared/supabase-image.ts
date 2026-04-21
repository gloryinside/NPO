/**
 * Supabase storage public URL에 transformation 쿼리 파라미터를 붙인다.
 * 외부 URL 또는 알 수 없는 URL은 그대로 반환.
 *
 * 사용 예:
 *   supabaseImage(url, { width: 400, quality: 75 })  // 썸네일용
 *   supabaseImage(url, { width: 1920 })              // 전체화면 뷰어용
 */
interface Options {
  width?: number
  height?: number
  quality?: number   // 1~100
  resize?: 'cover' | 'contain' | 'fill'
}

const SUPABASE_HOSTS_HINT = /supabase\.co\/storage\/v1\/object\/public\//

export function supabaseImage(url: string, opts: Options): string {
  if (!url) return url
  if (!SUPABASE_HOSTS_HINT.test(url)) return url  // 외부 이미지는 원본

  // /object/public/ → /render/image/public/ 으로 변환 시 transformation 활성
  try {
    const u = new URL(url)
    u.pathname = u.pathname.replace('/object/public/', '/render/image/public/')
    if (opts.width) u.searchParams.set('width', String(opts.width))
    if (opts.height) u.searchParams.set('height', String(opts.height))
    if (opts.quality) u.searchParams.set('quality', String(opts.quality))
    if (opts.resize) u.searchParams.set('resize', opts.resize)
    return u.toString()
  } catch {
    return url
  }
}
