import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_DIRECTIONS = new Set(["to_beneficiary", "to_sponsor"]);

/**
 * GET  /api/admin/sponsorships/[id]/letters  — 결연 편지 이력
 * POST /api/admin/sponsorships/[id]/letters  — 편지 등록 (어드민이 수기 입력 또는 OCR/스캔)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: sponsorshipId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sponsor_letters")
    .select("id, direction, original_text, translated_text, attachments, status, reviewed_at, delivered_at, rejection_reason, created_at")
    .eq("org_id", tenant.id)
    .eq("sponsorship_id", sponsorshipId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: sponsorshipId } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const direction = typeof body.direction === "string" ? body.direction : "";
  if (!VALID_DIRECTIONS.has(direction)) {
    return NextResponse.json({ error: "direction 필수" }, { status: 400 });
  }
  const originalText = typeof body.originalText === "string" ? body.originalText : "";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!originalText && attachments.length === 0) {
    return NextResponse.json(
      { error: "originalText 또는 attachments 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sponsor_letters")
    .insert({
      org_id: tenant.id,
      sponsorship_id: sponsorshipId,
      direction,
      original_text: originalText || null,
      attachments,
      status: "received",
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
