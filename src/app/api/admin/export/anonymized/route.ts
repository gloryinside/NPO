import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CSV_BOM, csvRow } from "@/lib/csv/escape";
import { logAudit } from "@/lib/audit";
import crypto from "node:crypto";
import { hasAnyRole } from "@/lib/auth/admin-rbac";

/**
 * G-D163: 외부 분석가 제공용 익명화 데이터 CSV.
 *
 * - member_id → SHA256(member_id + 운영자별 salt) 8자 prefix
 * - email / phone / 이름 / 주소 / 생년월일 미포함
 * - 결제 금액·날짜·상태·캠페인 slug 유지
 *
 * finance 또는 super 만 실행 가능.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json(
      { error: "finance 또는 super 권한 필요" },
      { status: 403 }
    );
  }

  const salt = process.env.ANONYMIZATION_SALT ?? tenant.id;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "pay_date, amount, pay_status, pay_method, member_id, campaigns(slug), promises(type)"
    )
    .eq("org_id", tenant.id)
    .order("pay_date", { ascending: false })
    .limit(10000);

  type Row = {
    pay_date: string | null;
    amount: number | null;
    pay_status: string | null;
    pay_method: string | null;
    member_id: string | null;
    campaigns: { slug: string } | null;
    promises: { type: string } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  const lines: string[] = [
    csvRow([
      "pay_date",
      "amount",
      "pay_status",
      "pay_method",
      "member_hash",
      "campaign_slug",
      "promise_type",
    ]),
  ];
  for (const r of rows) {
    lines.push(
      csvRow([
        r.pay_date ?? "",
        r.amount ?? 0,
        r.pay_status ?? "",
        r.pay_method ?? "",
        r.member_id ? hashId(r.member_id, salt) : "",
        r.campaigns?.slug ?? "",
        r.promises?.type ?? "",
      ])
    );
  }
  const body = CSV_BOM + lines.join("\r\n");

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const filename = `anonymized_payments_${today}.csv`;

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.data_export",
    resourceType: "anonymized_payments",
    summary: `익명화 결제 내역 CSV (${rows.length}건)`,
    metadata: { count: rows.length, filters: Object.fromEntries(sp) },
  }).catch(() => {});

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function hashId(id: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(id + ":" + salt, "utf8")
    .digest("hex")
    .slice(0, 16);
}
