import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 7-C / G-116: 응원 메시지 변경 시 공개 페이지 ISR 즉시 무효화.
 *
 * 캠페인 공개 페이지(`/campaigns/[slug]`)는 `revalidate = 60` ISR — donor
 * 본인 삭제/관리자 숨김 후에도 최대 60초 동안 이전 벽이 노출될 수 있다.
 *
 * cheer row의 `campaign_id`로 `campaigns.slug`를 한 번 조회해 `revalidatePath`를
 * 호출한다. campaign_id가 null(일반 응원)인 경우는 해당 벽이 노출되는 공개 경로가
 * 현재 없으므로 무효화 없이 반환.
 *
 * best-effort: 실패해도 API 주 흐름에 영향 없도록 try/catch로 흡수한다.
 */
export async function revalidateCheerCampaignPath(
  supabase: SupabaseClient,
  cheerId: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from('cheer_messages')
      .select('campaign_id, campaigns!cheer_messages_campaign_id_fkey(slug)')
      .eq('id', cheerId)
      .maybeSingle()

    const row = data as {
      campaign_id: string | null
      campaigns: { slug: string | null } | null
    } | null
    const slug = row?.campaigns?.slug
    if (!slug) return

    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/campaigns/${slug}`)
  } catch (err) {
    console.warn('[cheer revalidate] failed:', err)
  }
}
