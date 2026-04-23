import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { CSV_BOM, csvRow } from "@/lib/csv/escape";

/**
 * G-D05: 후원자 본인 납입내역 CSV 내보내기
 *
 * GET /api/donor/payments/export?year=2026&month=4&status=paid
 *  - 필터는 /donor/payments 페이지와 동일 의미
 *  - 최대 5000건까지 내보내기 (그 이상은 연도로 분할 권장)
 *  - UTF-8 BOM 포함 → Excel 한글 정상 표시
 */
const PAY_STATUS_LABEL: Record<string, string> = {
  paid: "완료",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환불",
  pending: "대기",
};

const ALLOWED_STATUS = new Set([
  "paid",
  "unpaid",
  "failed",
  "cancelled",
  "refunded",
  "pending",
]);

const HEADERS = [
  "결제일",
  "캠페인",
  "후원유형",
  "약정코드",
  "결제금액",
  "결제상태",
  "결제수단",
  "영수증코드",
  "비고",
];

export async function GET(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(
    `payments:export:${session.member.id}`,
    10,
    60_000
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const yearRaw = sp.get("year");
  const monthRaw = sp.get("month");
  const statusRaw = sp.get("status");
  // G-D34: 커스텀 날짜 범위 — year/month 보다 우선 적용
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");

  const year = yearRaw ? Number(yearRaw) : null;
  const month = monthRaw ? Number(monthRaw) : null;
  if (year !== null && (!Number.isFinite(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: "유효하지 않은 연도" }, { status: 400 });
  }
  if (month !== null && (!Number.isFinite(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: "유효하지 않은 월" }, { status: 400 });
  }
  const status = statusRaw && ALLOWED_STATUS.has(statusRaw) ? statusRaw : null;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : null;
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : null;
  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json(
      { error: "날짜 형식은 YYYY-MM-DD 이어야 합니다." },
      { status: 400 }
    );
  }
  if (from && to && from > to) {
    return NextResponse.json(
      { error: "시작일이 종료일보다 늦을 수 없습니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("payments")
    .select(
      "id, pay_date, amount, pay_status, pay_method, note, campaigns(title), promises(promise_code, type), receipts(receipt_code)",
      { count: "exact" }
    )
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("pay_date", { ascending: false, nullsFirst: false });

  // 날짜 필터: from/to 가 우선, 없으면 year/month 로 폴백
  if (from || to) {
    if (from) query = query.gte("pay_date", from);
    if (to) query = query.lte("pay_date", to);
  } else if (year !== null) {
    if (month !== null) {
      const ym = `${year}-${String(month).padStart(2, "0")}`;
      const lastDay = new Date(year, month, 0).getDate();
      query = query
        .gte("pay_date", `${ym}-01`)
        .lte("pay_date", `${ym}-${String(lastDay).padStart(2, "0")}`);
    } else {
      query = query.gte("pay_date", `${year}-01-01`).lte("pay_date", `${year}-12-31`);
    }
  }
  if (status) query = query.eq("pay_status", status);

  const LIMIT = 5000;
  // G-D58: 총 건수 확인 (count) + truncate 여부 경고
  const { data, error, count } = await query
    .range(0, LIMIT - 1)
    .returns<unknown[]>();
  if (error) {
    return NextResponse.json(
      { error: "내역을 불러올 수 없습니다.", detail: error.message },
      { status: 500 }
    );
  }
  const totalCount = typeof count === "number" ? count : null;
  const truncated = totalCount !== null && totalCount > LIMIT;

  type Row = {
    id: string;
    pay_date: string | null;
    amount: number | null;
    pay_status: string | null;
    pay_method: string | null;
    note: string | null;
    campaigns: { title: string } | null;
    promises: { promise_code: string | null; type: string | null } | null;
    receipts: { receipt_code: string | null } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  const lines: string[] = [csvRow(HEADERS)];
  for (const r of rows) {
    const date = r.pay_date
      ? new Date(r.pay_date).toLocaleDateString("ko-KR")
      : "";
    const typeLabel =
      r.promises?.type === "regular"
        ? "정기"
        : r.promises?.type === "onetime"
          ? "일시"
          : "";
    lines.push(
      csvRow([
        date,
        r.campaigns?.title ?? "",
        typeLabel,
        r.promises?.promise_code ?? "",
        r.amount ?? 0,
        PAY_STATUS_LABEL[r.pay_status ?? ""] ?? r.pay_status ?? "",
        r.pay_method ?? "",
        r.receipts?.receipt_code ?? "",
        r.note ?? "",
      ])
    );
  }

  // G-D58: truncate 경고를 CSV 최상단 주석 + HTTP 헤더로 노출
  const header = truncated
    ? `# 주의: 총 ${totalCount}건 중 ${LIMIT}건만 포함. 연도·월 필터로 분할 내보내기 권장.\r\n`
    : "";
  const body = CSV_BOM + header + lines.join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  const filterLabel = (() => {
    if (from || to) return `${from ?? "start"}_${to ?? "end"}`;
    const parts = [
      year !== null ? `${year}` : "all",
      month !== null ? String(month).padStart(2, "0") : null,
      status,
    ].filter(Boolean);
    return parts.join("-") || "all";
  })();
  const filename = `payments_${filterLabel}_${today}.csv`;

  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
  if (totalCount !== null) {
    headers["X-Total-Count"] = String(totalCount);
    headers["X-Included-Count"] = String(rows.length);
    if (truncated) headers["X-Truncated"] = "true";
  }
  return new NextResponse(body, { status: 200, headers });
}
