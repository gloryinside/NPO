import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_SOURCE = new Set(["naver_happybean", "kakao_samevalue", "tmoney", "other"]);

/**
 * GET /api/admin/external-donation-imports?status=pending
 * POST /api/admin/external-donation-imports — 외부 모금 import (1건씩 또는 bulk)
 *   body 단건: { source, sourceDonationId, donorName, amount, donatedAt, ... }
 *   body bulk:  { items: [...] }
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("external_donation_imports")
    .select("id, source, source_donation_id, donor_name, donor_phone, donor_email, amount, donated_at, match_status, matched_member_id, imported_at")
    .eq("org_id", tenant.id).order("donated_at", { ascending: false }).limit(300);
  if (status) q = q.eq("match_status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [body];
  const supabase = createSupabaseAdminClient();
  let imported = 0; let autoMatched = 0;

  for (const it of items) {
    const source = typeof it.source === "string" ? it.source : "";
    const amount = Number(it.amount ?? NaN);
    const donatedAt = typeof it.donatedAt === "string" ? it.donatedAt : "";
    if (!VALID_SOURCE.has(source) || !(amount > 0) || !donatedAt) continue;

    // 자동 매칭 시도: 폰 번호로 회원 검색
    let matchedMemberId: string | null = null;
    let matchStatus: "auto_matched" | "pending" = "pending";
    const phone = typeof it.donorPhone === "string" ? it.donorPhone : null;
    if (phone) {
      const { data: member } = await supabase
        .from("members").select("id")
        .eq("org_id", tenant.id).eq("phone", phone).maybeSingle();
      if (member) {
        matchedMemberId = member.id;
        matchStatus = "auto_matched";
        autoMatched++;
      }
    }

    const { error } = await supabase.from("external_donation_imports").insert({
      org_id: tenant.id,
      source,
      source_donation_id: typeof it.sourceDonationId === "string" ? it.sourceDonationId : null,
      donor_name: typeof it.donorName === "string" ? it.donorName : null,
      donor_phone: phone,
      donor_email: typeof it.donorEmail === "string" ? it.donorEmail : null,
      amount,
      donated_at: donatedAt,
      campaign_external_id: typeof it.campaignExternalId === "string" ? it.campaignExternalId : null,
      matched_member_id: matchedMemberId,
      match_status: matchStatus,
      raw_data: it.rawData ?? null,
    });
    if (!error) imported++;
  }

  return NextResponse.json({ imported, autoMatched });
}
