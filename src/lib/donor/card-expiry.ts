import type { SupabaseClient } from "@supabase/supabase-js";
import { kstYmd } from "@/lib/donor/kst-time";

/**
 * G-D50: 활성 약정 중 카드 만료 임박(<= 60일) 레코드 조회.
 * 만료 월은 해당 월 말일 기준으로 판단.
 */
export interface ExpiringCard {
  promiseId: string;
  promiseCode: string;
  campaignTitle: string | null;
  expiryYear: number;
  expiryMonth: number;
  daysUntilExpiry: number;
}

export async function getExpiringCards(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
  windowDays: number = 60
): Promise<ExpiringCard[]> {
  const { data } = await supabase
    .from("promises")
    .select(
      "id, promise_code, card_expiry_year, card_expiry_month, campaigns(title)"
    )
    .eq("org_id", orgId)
    .eq("member_id", memberId)
    .in("status", ["active", "suspended"])
    .not("card_expiry_year", "is", null)
    .not("card_expiry_month", "is", null);

  const rows =
    (data as unknown as Array<{
      id: string;
      promise_code: string;
      card_expiry_year: number;
      card_expiry_month: number;
      campaigns: { title: string } | null;
    }>) ?? [];

  const { year: nowY, month: nowM, day: nowD } = kstYmd();
  const todayMs = Date.UTC(nowY, nowM - 1, nowD);

  const result: ExpiringCard[] = [];
  for (const r of rows) {
    // 만료월 말일 기준
    const lastDay = new Date(
      Date.UTC(r.card_expiry_year, r.card_expiry_month, 0)
    ).getUTCDate();
    const expMs = Date.UTC(
      r.card_expiry_year,
      r.card_expiry_month - 1,
      lastDay
    );
    const days = Math.floor((expMs - todayMs) / 86400000);
    if (days <= windowDays) {
      result.push({
        promiseId: r.id,
        promiseCode: r.promise_code,
        campaignTitle: r.campaigns?.title ?? null,
        expiryYear: r.card_expiry_year,
        expiryMonth: r.card_expiry_month,
        daysUntilExpiry: days,
      });
    }
  }
  return result.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}
