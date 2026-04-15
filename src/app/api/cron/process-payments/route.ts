import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePaymentCode } from "@/lib/codes";

/**
 * GET /api/cron/process-payments
 *
 * Vercel Cron Job — runs daily at 09:00 KST (00:00 UTC).
 * vercel.json:
 *   { "crons": [{ "path": "/api/cron/process-payments", "schedule": "0 0 * * *" }] }
 *
 * For every active regular promise whose pay_day matches today (KST),
 * creates an `unpaid` payment row if one does not already exist for
 * this promise + month.
 *
 * Security: requires X-Cron-Secret header matching CRON_SECRET env var.
 * Vercel sets this automatically when configured via vercel.json `headers`.
 * In manual test, pass the header explicitly.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get("x-cron-secret") ?? "";
    if (header !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // No secret configured — only allow in non-production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET is required in production" },
        { status: 401 }
      );
    }
  }

  const supabase = createSupabaseAdminClient();

  // KST = UTC+9
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayDay = nowKst.getUTCDate(); // day-of-month in KST
  const yearKst = nowKst.getUTCFullYear();
  const monthKst = nowKst.getUTCMonth() + 1; // 1-12

  // Month prefix for idempotency key (e.g. "2026-04")
  const monthPrefix = `${yearKst}-${String(monthKst).padStart(2, "0")}`;

  // Fetch all active regular promises due today
  const { data: promises, error: fetchErr } = await supabase
    .from("promises")
    .select("id, org_id, member_id, campaign_id, amount, pay_method")
    .eq("status", "active")
    .eq("type", "regular")
    .eq("pay_day", todayDay);

  if (fetchErr) {
    console.error("[cron] fetch promises failed:", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!promises || promises.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0, errors: 0 });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const promise of promises) {
    // Idempotency key: cron-{promiseId}-{YYYY-MM}
    // Prevents duplicate rows if cron runs more than once in a day.
    const idempotencyKey = `cron-${promise.id}-${monthPrefix}`;

    // Check if already created this month
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Generate payment code: count existing payments for this org this year + 1
    const { count: existingCount } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", promise.org_id)
      .gte("created_at", `${yearKst}-01-01`)
      .lt("created_at", `${yearKst + 1}-01-01`);

    const paymentCode = generatePaymentCode(
      yearKst,
      (existingCount ?? 0) + 1
    );

    // Create unpaid payment row — waiting for auto-charge or manual collection
    const { error: insertErr } = await supabase.from("payments").insert({
      org_id: promise.org_id,
      member_id: promise.member_id,
      campaign_id: promise.campaign_id ?? null,
      promise_id: promise.id,
      payment_code: paymentCode,
      amount: promise.amount,
      pay_status: "unpaid",
      pay_method: promise.pay_method ?? "card",
      idempotency_key: idempotencyKey,
      pay_date: nowKst.toISOString().slice(0, 10),
    });

    if (insertErr) {
      console.error(
        `[cron] insert payment failed for promise ${promise.id}:`,
        insertErr.message
      );
      errors++;
    } else {
      processed++;
    }
  }

  console.log(
    `[cron/process-payments] day=${todayDay} processed=${processed} skipped=${skipped} errors=${errors}`
  );

  return NextResponse.json({ processed, skipped, errors });
}
