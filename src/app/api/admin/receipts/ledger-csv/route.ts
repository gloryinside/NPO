import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstParts } from "@/lib/billing/kst";
import { logAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/api-guard";

/**
 * GET /api/admin/receipts/ledger-csv?year=2026 — 기부금영수증 발급 대장 CSV(엑셀용 UTF-8 BOM).
 * 주민번호는 넣지 않는다. 취소·재발급으로 대체된 영수증도 상태와 함께 남긴다(대장이므로).
 * 예전 화면의 "CSV 다운로드" 링크가 가리키던 경로가 없어 404였다.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user: adminUser } = guard.ctx;
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : kstParts().year;
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json({ error: "year 파라미터가 유효하지 않습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  type Row = { receipt_code: string; issued_at: string | null; total_amount: number; status: string | null; members: { member_code: string; name: string } | null };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("receipts")
      .select("receipt_code, issued_at, total_amount, status, members(member_code, name)")
      .eq("org_id", tenant.id)
      .eq("year", year)
      .order("receipt_code", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data?.length ?? 0) < 1000) break;
  }

  // 엑셀 수식 주입 방지(=, +, -, @로 시작하는 값은 앞에 ' 붙임) + 따옴표 이스케이프
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const STATUS: Record<string, string> = { issued: "발급", cancelled: "취소(대체)" };
  const lines = [
    ["영수증번호", "발급일", "후원자번호", "성명", "금액", "상태"].map(cell).join(","),
    ...rows.map((r) =>
      [r.receipt_code, (r.issued_at ?? "").slice(0, 10), r.members?.member_code ?? "", r.members?.name ?? "", r.total_amount, STATUS[r.status ?? "issued"] ?? r.status]
        .map(cell)
        .join(","),
    ),
  ];

  void logAudit({
    orgId: tenant.id,
    actorId: adminUser.id,
    actorEmail: adminUser.email ?? null,
    action: "receipt.ledger_export",
    resourceType: "receipt",
    resourceId: null,
    summary: `${year}년 영수증 발급 대장 ${rows.length}건 내려받기`,
  });

  return new NextResponse("﻿" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receipt_ledger_${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
