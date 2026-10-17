/**
 * 랜딩페이지 게시 이력 — 게시할 때마다 스냅샷을 org_landing_history에 쌓는다(append-only).
 * 복원은 스냅샷을 "초안"으로만 되돌린다. 관리자가 미리보기로 확인한 뒤 다시 게시해야 공개된다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LandingSection } from '@/types/landing'

/** 저장·게시 모두 이 값으로 기록한다(예전엔 저장=1, 게시=2로 어긋났다) */
export const LANDING_SCHEMA_VERSION = 2 as const

/** 편집기에 보여 줄 이력 개수 */
export const HISTORY_LIST_LIMIT = 50

export type LandingContent = { schemaVersion: number; sections: LandingSection[] }

export type HistoryEntry = {
  id: string
  sectionCount: number
  publishedByEmail: string | null
  createdAt: string
}

/**
 * 게시 스냅샷 기록. 게시 자체는 이미 끝난 뒤라 실패해도 게시를 되돌리지 않고 결과만 알린다.
 */
export async function recordPublish(
  supabase: SupabaseClient,
  orgId: string,
  content: LandingContent,
  by: { id: string; email?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('org_landing_history').insert({
    org_id: orgId,
    content,
    section_count: content.sections.length,
    published_by: by.id,
    published_by_email: by.email ?? null,
  })
  if (error) {
    console.error('[landing publish] history insert failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
