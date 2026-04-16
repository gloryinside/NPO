import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/payments — ERP 연동 API: 납입정보 조회
 *
 * 도너스 API 패턴 기반. 외부 ERP 시스템이 Bearer token으로 인증하여
 * 납입 내역을 조회한다. org_secrets.erp_api_key로 기관을 식별한다.
 *
 * Query params:
 *   startDate   (YYYY-MM-DD, 필수)
 *   endDate     (YYYY-MM-DD, 필수)
 *   dateType    (payDate | depositDate, 기본 payDate)
 *   incomeStatus (1=pending, 2=processing, 3=confirmed, 4=excluded)
 *   memberIdx   (member UUID)
 *   count       (페이지 크기, 기본 100, 최대 1000)
 *   offset      (오프셋, 기본 0)
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateErp(req);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }
  const orgId = authResult.orgId;
  const url = req.nextUrl;

  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate, endDate 필수" },
      { status: 400 }
    );
  }

  const dateType = url.searchParams.get("dateType") ?? "payDate";
  const incomeStatusParam = url.searchParams.get("incomeStatus");
  const memberIdx = url.searchParams.get("memberIdx");
  const count = Math.min(Number(url.searchParams.get("count") ?? 100), 1000);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const dateCol = dateType === "depositDate" ? "deposit_date" : "pay_date";

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("payments")
    .select(
      "id, payment_code, member_id, promise_id, campaign_id, amount, pay_date, deposit_date, income_status, pay_status, pg_method, pay_method, created_at, members(id, member_code, name), promises(id, promise_code), campaigns(id, slug, title)",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .gte(dateCol, startDate)
    .lte(dateCol, endDate)
    .order(dateCol, { ascending: true })
    .range(offset, offset + count - 1);

  if (incomeStatusParam) {
    const statusMap: Record<string, string> = {
      "1": "pending",
      "2": "processing",
      "3": "confirmed",
      "4": "excluded",
    };
    const mapped = statusMap[incomeStatusParam];
    if (mapped) {
      query = query.eq("income_status", mapped);
    }
  }

  if (memberIdx) {
    query = query.eq("member_id", memberIdx);
  }

  const { data, error, count: totalCount } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 도너스 API 형식에 맞춰 응답
  const payments = (data ?? []).map((row: Record<string, unknown>) => {
    const members = row.members as { id: string; member_code: string; name: string } | null;
    const promises = row.promises as { id: string; promise_code: string } | null;
    const campaigns = row.campaigns as { id: string; slug: string; title: string } | null;
    return {
      paymentIdx: row.id,
      paymentCode: row.payment_code,
      memberIdx: row.member_id,
      memberCode: members?.member_code ?? null,
      name: members?.name ?? null,
      promiseIdx: row.promise_id,
      promiseCode: promises?.promise_code ?? null,
      productCode: campaigns?.slug ?? null,
      payPrice: row.amount,
      payDate: row.pay_date,
      depositDate: row.deposit_date,
      incomeStatus: incomeStatusCode(row.income_status as string),
      payMethodType: row.pg_method ?? row.pay_method ?? null,
    };
  });

  return NextResponse.json({
    startDate,
    endDate,
    incomeStatus: incomeStatusParam ? Number(incomeStatusParam) : null,
    totalCount: totalCount ?? 0,
    payments,
  });
}

function incomeStatusCode(status: string): number {
  switch (status) {
    case "pending": return 1;
    case "processing": return 2;
    case "confirmed": return 3;
    case "excluded": return 4;
    default: return 0;
  }
}

type AuthSuccess = { orgId: string };
type AuthError = { error: string; status: number };

async function authenticateErp(
  req: NextRequest
): Promise<AuthSuccess | AuthError> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { error: "Bearer token required", status: 401 };
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return { error: "Empty token", status: 401 };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("org_secrets")
    .select("org_id")
    .eq("erp_api_key", token)
    .maybeSingle();

  if (error || !data) {
    return { error: "Invalid API key", status: 401 };
  }

  return { orgId: data.org_id };
}
