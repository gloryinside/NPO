import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_CHANNELS = new Set(["slack", "discord", "generic"]);
const VALID_EVENTS = [
  "payment.paid", "payment.failed", "payment.refunded",
  "promise.created", "promise.cancelled",
  "churn.high", "discrepancy.detected", "expense.approved",
];

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("external_webhook_subscriptions")
    .select("id, name, channel, webhook_url, event_types, min_amount, active, delivered_count, failed_count, last_delivered_at, last_error")
    .eq("org_id", tenant.id)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], availableEvents: VALID_EVENTS });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel : "";
  const url = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  const events = Array.isArray(body.eventTypes)
    ? (body.eventTypes as unknown[]).filter((e): e is string => typeof e === "string" && VALID_EVENTS.includes(e))
    : [];

  if (!name || !VALID_CHANNELS.has(channel) || !url || events.length === 0) {
    return NextResponse.json({ error: "name, channel, webhookUrl, eventTypes 필수" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "webhookUrl http/https" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("external_webhook_subscriptions")
    .insert({
      org_id: tenant.id,
      name, channel, webhook_url: url,
      event_types: events,
      min_amount: typeof body.minAmount === "number" ? body.minAmount : null,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
