import { cronSecretMatches } from "@/lib/cron/runner";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextCode } from "@/lib/codes-seq";
import { kstParts, kstToday } from "@/lib/billing/kst";

/**
 * GET /api/cron/process-payments
 *
 * Vercel Cron Job — runs daily at 09:00 KST (00:00 UTC).
 * vercel.json:
 *   { "crons": [{ "path": "/api/cron/process-payments", "schedule": "0 0 * * *" }] }
 *
 * For every active regular promise whose pay_day is today or earlier this month (KST),
 * creates an `unpaid` payment row if one does not already exist for
 * this promise + month (catch-up), then charges billing-key rows via charge-service.
 *
 * Security: requires X-Cron-Secret header matching CRON_SECRET env var.
 * Vercel sets this automatically when configured via vercel.json `headers`.
 * In manual test, pass the header explicitly.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
        if (!cronSecretMatches(req, cronSecret)) {
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

  // KST 기준 — 서버 시간대와 무관
  const { year: yearKst, month: monthKst, day: todayDay } = kstParts();
  const monthPrefix = `${yearKst}-${String(monthKst).padStart(2, "0")}`;
  const today = kstToday();

  // 이번 달 결제일이 오늘이거나 이미 지난 약정 — 크론이 하루 실패해도 같은 달 안에서 따라잡는다.
  // (예전: pay_day === 오늘 만 → 그날 실패하면 그 달 청구가 영영 빠졌다)
  const { data: promises, error: fetchErr } = await supabase
    .from("promises")
    .select("id, org_id, member_id, campaign_id, amount, pay_method, pay_day, started_at")
    .eq("status", "active")
    .eq("type", "regular")
    .lte("pay_day", todayDay);

  if (fetchErr) {
    console.error("[cron] fetch promises failed:", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const promise of promises ?? []) {
    // 이번 달 결제일 이후에 시작한 약정은 이번 달 청구 대상이 아니다(가입 직후 즉시 청구 방지)
    const payDate = `${monthPrefix}-${String(promise.pay_day).padStart(2, "0")}`;
    if (promise.started_at && String(promise.started_at).slice(0, 10) > payDate) {
      skipped++;
      continue;
    }

    // Idempotency key: cron-{promiseId}-{YYYY-MM} — 약정·월당 1행 (org_id, idempotency_key UNIQUE)
    const idempotencyKey = `cron-${promise.id}-${monthPrefix}`;
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("org_id", promise.org_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    // 결제 코드는 DB 카운터로 원자 발번 — 그래도 겹치면(손으로 넣은 번호 등) 새 번호로 최대 5번 시도
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      let paymentCode: string;
      try {
        paymentCode = await nextCode(supabase, promise.org_id, "payment", yearKst);
      } catch (e) {
        console.error(`[cron] payment code failed for promise ${promise.id}:`, (e as Error).message);
        errors++;
        break;
      }
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
        pay_date: payDate <= today ? payDate : today,
      });

      if (!insertErr) {
        inserted = true;
        processed++;
      } else if (insertErr.code === "23505" && insertErr.message.includes("idempotency")) {
        // 다른 실행이 먼저 만들었다
        inserted = true;
        skipped++;
      } else if (insertErr.code !== "23505") {
        console.error(`[cron] insert payment failed for promise ${promise.id}:`, insertErr.message);
        errors++;
        break;
      }
    }
  }

  // 빌링키 자동결제 실행
  const { processMonthlyCharges } = await import('@/lib/billing/charge-service');
  const orgIds = [...new Set((promises ?? []).map(p => p.org_id as string))];
  let totalCharged = 0;
  let totalFailed = 0;

  for (const oid of orgIds) {
    const result = await processMonthlyCharges(oid);
    totalCharged += result.charged;
    totalFailed += result.failed;
  }

  console.log(
    `[cron/process-payments] day=${todayDay} processed=${processed} skipped=${skipped} errors=${errors} charged=${totalCharged} billingFailed=${totalFailed}`
  );

  return NextResponse.json({ processed, skipped, errors, charged: totalCharged, billingFailed: totalFailed });
}
