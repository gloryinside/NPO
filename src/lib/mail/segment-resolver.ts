import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 세그먼트 필터를 받아 발송 대상 회원 목록을 추출.
 *
 * 필터:
 *   tier:          ['gold','platinum'] — members.tier in (...)
 *   tagIds:        ['uuid1','uuid2']   — 해당 태그가 부여된 회원
 *   minTotalPaid:  100000              — 누적 paid 합계 >= N
 *   activeOnly:    true                — members.status='active' 만
 *
 * 공통 필터:
 *   - members.address_disabled=false
 *   - members.address_full IS NOT NULL (주소 있는 회원만)
 *   - org_id 자동 격리
 */
export interface SegmentFilter {
  tier?: string[];
  tagIds?: string[];
  minTotalPaid?: number;
  activeOnly?: boolean;
}

export interface SegmentResult {
  memberId: string;
  name: string;
  address: string;
  tier: string | null;
  totalPaid: number;
}

export async function resolveSegment(
  supabase: SupabaseClient,
  orgId: string,
  filter: SegmentFilter,
): Promise<SegmentResult[]> {
  let q = supabase
    .from("members")
    .select("id, name, address_full, tier, status")
    .eq("org_id", orgId)
    .eq("address_disabled", false)
    .not("address_full", "is", null);

  if (filter.activeOnly) q = q.eq("status", "active");
  if (filter.tier?.length) q = q.in("tier", filter.tier);

  const { data: members, error } = await q;
  if (error || !members) return [];

  let memberIds = (members as Array<{ id: string }>).map((m) => m.id);

  // 태그 필터 (다대다)
  if (filter.tagIds?.length) {
    const { data: tagged } = await supabase
      .from("member_tag_assignments")
      .select("member_id")
      .eq("org_id", orgId)
      .in("tag_id", filter.tagIds)
      .in("member_id", memberIds);
    const taggedSet = new Set((tagged ?? []).map((r: { member_id: string }) => r.member_id));
    memberIds = memberIds.filter((id) => taggedSet.has(id));
  }

  // 누적 paid 필터
  let totalsByMember = new Map<string, number>();
  if (filter.minTotalPaid && filter.minTotalPaid > 0) {
    const { data: pays } = await supabase
      .from("payments")
      .select("member_id, amount")
      .eq("org_id", orgId)
      .eq("pay_status", "paid")
      .in("member_id", memberIds);
    for (const p of (pays ?? []) as Array<{ member_id: string | null; amount: number | null }>) {
      if (!p.member_id) continue;
      totalsByMember.set(
        p.member_id,
        (totalsByMember.get(p.member_id) ?? 0) + Number(p.amount ?? 0)
      );
    }
    memberIds = memberIds.filter(
      (id) => (totalsByMember.get(id) ?? 0) >= (filter.minTotalPaid ?? 0)
    );
  } else {
    // minTotalPaid 미지정 — 합계 표시는 0으로
    totalsByMember = new Map();
  }

  const idSet = new Set(memberIds);
  return (members as Array<{
    id: string;
    name: string;
    address_full: string | null;
    tier: string | null;
  }>)
    .filter((m) => idSet.has(m.id))
    .map((m) => ({
      memberId: m.id,
      name: m.name,
      address: m.address_full ?? "",
      tier: m.tier,
      totalPaid: totalsByMember.get(m.id) ?? 0,
    }));
}
