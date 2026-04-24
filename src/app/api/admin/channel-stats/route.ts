import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/channel-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   채널별 모금 합계 (payments.channel_id 기준 + channel_settlements 합계 병합).
 *   payments.channel_id 가 NULL인 건은 'unassigned'로 분류.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10);

  const supabase = createSupabaseAdminClient();
  const [pays, settlements, channels] = await Promise.all([
    supabase
      .from("payments")
      .select("channel_id, amount")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid")
      .gte("pay_date", from)
      .lte("pay_date", to),
    supabase
      .from("channel_settlements")
      .select("channel_id, cash_amount")
      .eq("org_id", tenant.id)
      .gte("settlement_date", from)
      .lte("settlement_date", to),
    supabase
      .from("donation_channels")
      .select("id, code, name, channel_type")
      .eq("org_id", tenant.id),
  ]);

  const byChannel = new Map<string, { paymentSum: number; settlementSum: number }>();
  const upsertCh = (id: string, key: 'paymentSum' | 'settlementSum', amt: number) => {
    const cur = byChannel.get(id) ?? { paymentSum: 0, settlementSum: 0 };
    cur[key] += amt;
    byChannel.set(id, cur);
  };

  for (const p of (pays.data ?? []) as Array<{ channel_id: string | null; amount: number | null }>) {
    upsertCh(p.channel_id ?? 'unassigned', 'paymentSum', Number(p.amount ?? 0));
  }
  for (const s of (settlements.data ?? []) as Array<{ channel_id: string; cash_amount: number | null }>) {
    upsertCh(s.channel_id, 'settlementSum', Number(s.cash_amount ?? 0));
  }

  const channelMap = new Map(
    (channels.data ?? []).map((c: { id: string; code: string; name: string; channel_type: string }) =>
      [c.id, c]
    )
  );

  const items = Array.from(byChannel.entries()).map(([id, sums]) => {
    const ch = channelMap.get(id);
    return {
      channelId: id,
      code: ch?.code ?? null,
      name: ch?.name ?? (id === 'unassigned' ? '(미지정)' : id),
      channelType: ch?.channel_type ?? null,
      paymentSum: sums.paymentSum,
      settlementSum: sums.settlementSum,
      total: sums.paymentSum + sums.settlementSum,
    };
  }).sort((a, b) => b.total - a.total);

  return NextResponse.json({ items, range: { from, to } });
}
