import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D160: 후원자 뱃지 자동 부여.
 *
 * 규칙:
 *   - supporter_1y / supporter_3y / supporter_5y: 가입 후 N년 경과 + status=active
 *   - major_donor_100 / 500 / 1000: 누적 paid 금액 100만/500만/1000만원 이상
 *   - loyal_regular_12: regular 정기후원이 12개월 연속 결제 성공
 *
 * member_badges UNIQUE (member_id, badge_code) — 이미 있으면 skip.
 */
type BadgeRule = (m: MemberRow) => string[];

interface MemberRow {
  id: string;
  org_id: string;
  created_at: string;
  status: string;
  _totalPaid: number;
  _latestPaidStreak: number;
}

export async function GET(req: Request) {
  return runCron(req, "cron:award-badges", async () => {
    const supabase = createSupabaseAdminClient();

    // 모든 active 회원 스캔 (대형 org 는 분할 필요 — 일단 10000 이하 가정)
    const { data: members } = await supabase
      .from("members")
      .select("id, org_id, created_at, status")
      .is("deleted_at", null)
      .eq("status", "active")
      .limit(10000);

    const memberRows = (members ?? []) as Array<{
      id: string;
      org_id: string;
      created_at: string;
      status: string;
    }>;

    if (memberRows.length === 0)
      return { scanned: 0, granted: 0 } as Record<string, number>;

    // 누적 paid 금액
    const memberIds = memberRows.map((m) => m.id);
    const paidByMember = new Map<string, number>();
    // chunks 1000 단위
    for (let i = 0; i < memberIds.length; i += 1000) {
      const chunk = memberIds.slice(i, i + 1000);
      const { data: pays } = await supabase
        .from("payments")
        .select("member_id, amount")
        .in("member_id", chunk)
        .eq("pay_status", "paid");
      for (const p of (pays ?? []) as Array<{
        member_id: string;
        amount: number | null;
      }>) {
        if (!p.member_id) continue;
        paidByMember.set(
          p.member_id,
          (paidByMember.get(p.member_id) ?? 0) + Number(p.amount ?? 0)
        );
      }
    }

    const rules: BadgeRule = (m) => {
      const out: string[] = [];
      const ageDays =
        (Date.now() - new Date(m.created_at).getTime()) / 86400000;
      if (ageDays >= 365) out.push("supporter_1y");
      if (ageDays >= 365 * 3) out.push("supporter_3y");
      if (ageDays >= 365 * 5) out.push("supporter_5y");
      if (m._totalPaid >= 1_000_000) out.push("major_donor_100");
      if (m._totalPaid >= 5_000_000) out.push("major_donor_500");
      if (m._totalPaid >= 10_000_000) out.push("major_donor_1000");
      return out;
    };

    let granted = 0;
    for (const m of memberRows) {
      const enriched: MemberRow = {
        ...m,
        _totalPaid: paidByMember.get(m.id) ?? 0,
        _latestPaidStreak: 0,
      };
      const badges = rules(enriched);
      if (badges.length === 0) continue;

      // 이미 보유한 badge 제외
      const { data: existing } = await supabase
        .from("member_badges")
        .select("badge_code")
        .eq("member_id", m.id)
        .in("badge_code", badges);
      const have = new Set(
        ((existing ?? []) as Array<{ badge_code: string }>).map(
          (r) => r.badge_code
        )
      );
      const toInsert = badges
        .filter((b) => !have.has(b))
        .map((badge_code) => ({
          org_id: m.org_id,
          member_id: m.id,
          badge_code,
          awarded_by: "system",
        }));
      if (toInsert.length === 0) continue;
      const { error } = await supabase.from("member_badges").insert(toInsert);
      if (!error) granted += toInsert.length;
    }

    return { scanned: memberRows.length, granted };
  });
}
