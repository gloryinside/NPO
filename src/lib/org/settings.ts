import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * 기관 설정 스키마. 모든 필드 optional — 기본값은 getOrgSettings가 주입.
 * 신규 필드 추가 시 여기에 추가하고 DEFAULTS에도 반영.
 */
export interface OrgSettings {
  /** 이탈 위험 주간 알림 수신 (기본 true) */
  weekly_alert_enabled: boolean
  /** 후원자 임팩트 페이지의 "지원 추정" 단가 (원). 기본 100_000 */
  impact_unit_amount: number
  /** 캠페인 목표 달성 감사 이메일 자동 발송 (기본 true) */
  campaign_thanks_enabled: boolean
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  weekly_alert_enabled: true,
  impact_unit_amount: 100_000,
  campaign_thanks_enabled: true,
}

/**
 * DB에서 settings JSONB를 읽어 기본값과 병합.
 * settings 컬럼이 없거나 NULL인 경우도 기본값 반환 — Phase 4-B 이전 마이그레이션 이행 전 안전.
 */
export async function getOrgSettings(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgSettings> {
  const { data } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  const raw = (data?.settings ?? {}) as Partial<OrgSettings>
  return {
    weekly_alert_enabled: raw.weekly_alert_enabled ?? DEFAULT_ORG_SETTINGS.weekly_alert_enabled,
    impact_unit_amount:
      typeof raw.impact_unit_amount === 'number' && raw.impact_unit_amount > 0
        ? raw.impact_unit_amount
        : DEFAULT_ORG_SETTINGS.impact_unit_amount,
    campaign_thanks_enabled: raw.campaign_thanks_enabled ?? DEFAULT_ORG_SETTINGS.campaign_thanks_enabled,
  }
}

/**
 * 부분 업데이트. 기존 settings와 merge 후 저장.
 */
export async function updateOrgSettings(
  supabase: SupabaseClient,
  orgId: string,
  partial: Partial<OrgSettings>,
): Promise<{ ok: boolean; error?: string; settings?: OrgSettings }> {
  const current = await getOrgSettings(supabase, orgId)
  const merged: OrgSettings = { ...current, ...partial }

  // 안전 검증
  if (merged.impact_unit_amount <= 0 || !Number.isFinite(merged.impact_unit_amount)) {
    return { ok: false, error: 'impact_unit_amount must be positive' }
  }

  const { error } = await supabase
    .from('orgs')
    .update({ settings: merged })
    .eq('id', orgId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, settings: merged }
}

/**
 * G-91: 서버 컴포넌트 전용 캐시드 래퍼.
 * 같은 요청 내에서 동일 orgId로 여러 번 호출돼도 DB 쿼리 1회만 실행.
 * React cache()는 요청 경계(request)마다 새 인스턴스라 tenant 간 오염 없음.
 *
 * cron 등 서버 컴포넌트 외부에서는 기존 getOrgSettings(supabase, orgId) 사용.
 */
export const getOrgSettingsCached = cache(async (orgId: string): Promise<OrgSettings> => {
  const supabase = createSupabaseAdminClient()
  return getOrgSettings(supabase, orgId)
})
