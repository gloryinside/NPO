import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_TYPES = new Set(["meetup", "gala", "volunteer", "workshop", "briefing", "other"]);
const VALID_STATUS = new Set(["planning", "open", "closed", "completed", "cancelled"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("events")
    .select(
      "id, title, event_type, start_at, end_at, location, capacity, status, registration_deadline"
    )
    .eq("org_id", tenant.id)
    .order("start_at", { ascending: false })
    .limit(100);
  if (status && VALID_STATUS.has(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  if (!title || !startAt) {
    return NextResponse.json({ error: "title, startAt 필수" }, { status: 400 });
  }

  const eventType = typeof body.eventType === "string" && VALID_TYPES.has(body.eventType)
    ? body.eventType : "meetup";
  const status = typeof body.status === "string" && VALID_STATUS.has(body.status)
    ? body.status : "planning";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      org_id: tenant.id,
      title,
      description: typeof body.description === "string" ? body.description : null,
      event_type: eventType,
      start_at: startAt,
      end_at: typeof body.endAt === "string" ? body.endAt : null,
      location: typeof body.location === "string" ? body.location : null,
      capacity: Number.isInteger(body.capacity) ? body.capacity : null,
      registration_required: body.registrationRequired !== false,
      registration_deadline:
        typeof body.registrationDeadline === "string" ? body.registrationDeadline : null,
      status,
      cover_image_url: typeof body.coverImageUrl === "string" ? body.coverImageUrl : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
