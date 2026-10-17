/**
 * 조건 저장형 후원자 명단 — 조건 검증·설명(순수 함수)과 조회.
 * 조건은 모두 AND. 저장 형식은 SQL 함수 segment_member_ids() 의 키(snake_case)와 같다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { kstToday } from "@/lib/billing/kst";
import { JOIN_PATHS } from "@/lib/donations/donor-profile";
import { PAY_METHOD_LABEL } from "@/lib/labels";

export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export const TIER_LABEL: Record<(typeof TIERS)[number], string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘",
  diamond: "다이아몬드",
};

export type SegmentFilter = {
  status?: "active" | "inactive";
  member_type?: "individual" | "corporate";
  tiers?: Array<(typeof TIERS)[number]>;
  join_path?: string;
  tag_id?: string;
  has_active_regular?: boolean;
  pay_method?: "card" | "cms" | "transfer" | "manual";
  /** 정기후원을 시작한 지 N개월 이상 */
  regular_months_min?: number;
  /** 최근 6개월 결제 실패·미납 N건 이상 */
  unpaid_min?: number;
  /** 마지막 후원 뒤로 N일 이상(휴면) */
  last_gift_days_min?: number;
  birthday_month?: number;
  marketing_consent?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function int(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/** 화면에서 온 값을 검증해 아는 키·범위만 남긴다(빈 값은 버린다) */
export function parseSegmentFilter(raw: unknown): SegmentFilter {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: SegmentFilter = {};
  if (r.status === "active" || r.status === "inactive") f.status = r.status;
  if (r.member_type === "individual" || r.member_type === "corporate") f.member_type = r.member_type;
  if (Array.isArray(r.tiers)) {
    const t = r.tiers.filter((x): x is (typeof TIERS)[number] => (TIERS as readonly unknown[]).includes(x));
    if (t.length) f.tiers = [...new Set(t)];
  }
  if (typeof r.join_path === "string" && (JOIN_PATHS as readonly string[]).includes(r.join_path)) f.join_path = r.join_path;
  if (typeof r.tag_id === "string" && UUID.test(r.tag_id)) f.tag_id = r.tag_id;
  if (typeof r.has_active_regular === "boolean") f.has_active_regular = r.has_active_regular;
  if (r.pay_method === "card" || r.pay_method === "cms" || r.pay_method === "transfer" || r.pay_method === "manual") f.pay_method = r.pay_method;
  const months = int(r.regular_months_min, 1, 600);
  if (months !== undefined) f.regular_months_min = months;
  const unpaid = int(r.unpaid_min, 1, 50);
  if (unpaid !== undefined) f.unpaid_min = unpaid;
  const days = int(r.last_gift_days_min, 1, 3650);
  if (days !== undefined) f.last_gift_days_min = days;
  const bm = int(r.birthday_month, 1, 12);
  if (bm !== undefined) f.birthday_month = bm;
  if (typeof r.marketing_consent === "boolean") f.marketing_consent = r.marketing_consent;
  return f;
}

/** 명단 이름 — 1~60자 */
export function parseSegmentName(v: unknown): string | null {
  const n = typeof v === "string" ? v.trim() : "";
  return n && n.length <= 60 ? n : null;
}

/** 조건을 사람이 읽는 말로 — 목록·저장 화면에 칩으로 보여 준다 */
export function describeSegment(f: SegmentFilter, tagNames: Record<string, string> = {}): string[] {
  const out: string[] = [];
  if (f.status) out.push(f.status === "active" ? "활동 중" : "활동 안 함");
  if (f.member_type) out.push(f.member_type === "corporate" ? "기업·단체" : "개인");
  if (f.tiers?.length) out.push(`등급 ${f.tiers.map((t) => TIER_LABEL[t]).join("·")}`);
  if (f.has_active_regular !== undefined) out.push(f.has_active_regular ? "정기후원 중" : "정기후원 안 함");
  if (f.pay_method) out.push(`${PAY_METHOD_LABEL[f.pay_method] ?? f.pay_method}로 후원`);
  if (f.regular_months_min) out.push(f.regular_months_min % 12 === 0 ? `정기후원 ${f.regular_months_min / 12}년 이상` : `정기후원 ${f.regular_months_min}개월 이상`);
  if (f.unpaid_min) out.push(`최근 6개월 미납 ${f.unpaid_min}회 이상`);
  if (f.last_gift_days_min) out.push(`마지막 후원 ${f.last_gift_days_min}일 이상 지남`);
  if (f.birthday_month) out.push(`${f.birthday_month}월 생일`);
  if (f.join_path) out.push(`알게 된 경로: ${f.join_path}`);
  if (f.tag_id) out.push(`분류: ${tagNames[f.tag_id] ?? "(삭제된 분류)"}`);
  if (f.marketing_consent !== undefined) out.push(f.marketing_consent ? "마케팅 수신 동의" : "마케팅 수신 미동의");
  return out.length ? out : ["모든 후원자"];
}

export async function segmentMemberIds(
  supabase: SupabaseClient,
  orgId: string,
  filter: SegmentFilter,
  today: string = kstToday(),
): Promise<string[]> {
  const { data, error } = await supabase.rpc("segment_member_ids", { p_org: orgId, p_f: filter, p_today: today });
  if (error) throw new Error(`명단 조회 실패: ${error.message}`);
  return ((data ?? []) as Array<{ member_id: string }>).map((r) => r.member_id);
}

export type SegmentMember = {
  id: string;
  member_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  tier: string | null;
  join_path: string | null;
  member_type: string | null;
};

/** id 목록의 후원자 정보(최대 limit명) */
export async function loadSegmentMembers(supabase: SupabaseClient, orgId: string, ids: string[], limit = 5000): Promise<SegmentMember[]> {
  const out: SegmentMember[] = [];
  const target = ids.slice(0, limit);
  for (let i = 0; i < target.length; i += 500) {
    const { data } = await supabase
      .from("members")
      .select("id, member_code, name, phone, email, tier, join_path, member_type")
      .eq("org_id", orgId)
      .in("id", target.slice(i, i + 500));
    out.push(...((data ?? []) as SegmentMember[]));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 엑셀에서 수식으로 실행되지 않게(=, +, -, @ 로 시작하는 글자) */
export function safeCsvText(s: string | null | undefined): string {
  const v = s ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
