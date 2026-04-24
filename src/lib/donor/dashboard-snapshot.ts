import type { SupabaseClient } from "@supabase/supabase-js";
import type { DonorDashboardSnapshot } from "@/types/dashboard";

/**
 * 후원자 대시보드 스냅샷 조회.
 * 내부적으로 PL/pgSQL 함수 `get_donor_dashboard_snapshot`을 호출해
 * 10개 쿼리를 1 RTT로 통합한다.
 */
export async function getDashboardSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<DonorDashboardSnapshot | null> {
  const { data, error } = await supabase.rpc("get_donor_dashboard_snapshot", {
    p_org_id: orgId,
    p_member_id: memberId,
  });
  if (error || !data) return null;
  return data as DonorDashboardSnapshot;
}
