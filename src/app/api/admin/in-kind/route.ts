import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["pending", "appraised", "accepted", "rejected"]);

/**
 * GET  /api/admin/in-kind  — 물품기부 목록 (status 필터 지원)
 * POST /api/admin/in-kind  — 신규 접수
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("in_kind_donations")
    .select(
      "id, member_id, donor_name, item_name, category, quantity, estimated_value, appraised_value, status, received_at, created_at, members(name)"
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && VALID_STATUS.has(status)) q = q.eq("status", status);
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

  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  if (!itemName) return NextResponse.json({ error: "itemName 필수" }, { status: 400 });

  const insert: Record<string, unknown> = {
    org_id: tenant.id,
    item_name: itemName,
    member_id: typeof body.memberId === "string" ? body.memberId : null,
    donor_name: typeof body.donorName === "string" ? body.donorName : null,
    donor_phone: typeof body.donorPhone === "string" ? body.donorPhone : null,
    donor_email: typeof body.donorEmail === "string" ? body.donorEmail : null,
    category: typeof body.category === "string" ? body.category : null,
    quantity: Number.isInteger(body.quantity) ? body.quantity : 1,
    description: typeof body.description === "string" ? body.description : null,
    estimated_value:
      typeof body.estimatedValue === "number" && body.estimatedValue >= 0
        ? body.estimatedValue
        : null,
    received_at: typeof body.receivedAt === "string" ? body.receivedAt : null,
    received_location: typeof body.receivedLocation === "string" ? body.receivedLocation : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    photo_urls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    status: "pending",
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("in_kind_donations")
    .insert(insert)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
