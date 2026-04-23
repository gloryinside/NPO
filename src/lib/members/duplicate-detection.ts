import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-D102: 회원 중복 후보 감지.
 *
 * 허위양성을 최소화하기 위해 "엄격한 조합" 기준만 사용:
 *   1) 같은 이메일 정확 일치 (대소문자 무시)
 *   2) 같은 전화번호 숫자만 추출 일치
 *   3) 이름 + 생년월일 동시 일치
 *
 * 반환:
 *   { groups: Array<{ key, matchType, members: [...] }> }
 *   - members 는 가장 오래된 계정이 먼저. admin 이 "대표 계정" 결정에 사용.
 */
export type DupeMatchType = "email" | "phone" | "name_birth";
export interface DupeMember {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  status: string | null;
  created_at: string | null;
  member_code: string | null;
}
export interface DupeGroup {
  key: string;
  matchType: DupeMatchType;
  members: DupeMember[];
}

export async function detectDuplicateMembers(
  supabase: SupabaseClient,
  orgId: string
): Promise<DupeGroup[]> {
  const { data } = await supabase
    .from("members")
    .select("id, name, email, phone, birth_date, status, created_at, member_code")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const rows = (data as unknown as DupeMember[]) ?? [];

  const byEmail = new Map<string, DupeMember[]>();
  const byPhone = new Map<string, DupeMember[]>();
  const byNameBirth = new Map<string, DupeMember[]>();

  for (const m of rows) {
    const em = (m.email ?? "").trim().toLowerCase();
    if (em) {
      const arr = byEmail.get(em) ?? [];
      arr.push(m);
      byEmail.set(em, arr);
    }
    const digits = (m.phone ?? "").replace(/\D/g, "");
    if (digits.length >= 8) {
      const arr = byPhone.get(digits) ?? [];
      arr.push(m);
      byPhone.set(digits, arr);
    }
    const n = (m.name ?? "").trim();
    const b = m.birth_date ?? "";
    if (n && b) {
      const key = `${n}|${b}`;
      const arr = byNameBirth.get(key) ?? [];
      arr.push(m);
      byNameBirth.set(key, arr);
    }
  }

  const groups: DupeGroup[] = [];
  for (const [key, members] of byEmail) {
    if (members.length >= 2) {
      groups.push({ key, matchType: "email", members });
    }
  }
  for (const [key, members] of byPhone) {
    if (members.length >= 2) {
      groups.push({ key, matchType: "phone", members });
    }
  }
  for (const [key, members] of byNameBirth) {
    if (members.length >= 2) {
      groups.push({ key, matchType: "name_birth", members });
    }
  }

  // 같은 멤버가 여러 매치로 중복 등장할 수 있음 — 그룹 단위로 그대로 노출
  // (admin 이 판단)
  return groups.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      a.matchType.localeCompare(b.matchType)
  );
}
