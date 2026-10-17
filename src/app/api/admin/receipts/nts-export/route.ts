import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstParts } from "@/lib/billing/kst";
import { logAudit } from "@/lib/audit";
import { buildXlsx } from "@/lib/export/xlsx";
import { buildNtsDataset, NTS_COLUMNS, type NtsSourceRow } from "@/lib/receipt/nts-dataset";
import { requireAdminApi } from "@/lib/auth/api-guard";

/**
 * GET /api/admin/receipts/nts-export?year=2026[&format=json]
 *
 * 국세청 제출용 기부자별 발급명세(홈택스 전자기부금영수증 일괄발급 업로드 대비) — lib/receipt/nts-dataset 참고.
 *  - format=json : 미리보기(건수·합계·제외 사유·기관 정보 누락). 주민번호는 내려주지 않는다.
 *  - 기본        : XLSX 다운로드. 서버에서 감사 로그·제출 이력(nts_export_logs)을 남긴다.
 *  - 취소·재발급으로 대체된 영수증은 제외. 주민번호 없는 기부자는 제외 사유와 함께 보고(조용히 빼지 않음).
 *  - 기관 필수 기재사항이 비면 다운로드를 막는다(422).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user: adminUser } = guard.ctx;

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : kstParts().year - 1;
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json({ error: "year 파라미터가 유효하지 않습니다." }, { status: 400 });
  }
  const preview = url.searchParams.get("format") === "json";

  const supabase = createSupabaseAdminClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("name, business_no, address, representative_name, donee_type, donee_legal_basis, donee_code, donation_type_code")
    .eq("id", tenant.id)
    .single();
  if (!org) return NextResponse.json({ error: "기관 정보를 찾을 수 없습니다." }, { status: 404 });

  const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
  if (!encKey) {
    return NextResponse.json({ error: "주민번호 복호화 키(RECEIPTS_ENCRYPTION_KEY)가 설정되지 않았습니다." }, { status: 500 });
  }

  // 유효 영수증만(취소·대체 제외) — 1000행 제한을 넘도록 페이지 단위로
  type ReceiptRow = {
    receipt_code: string;
    issued_at: string | null;
    total_amount: number;
    resident_no_encrypted: string | null;
    members: { id: string; name: string; id_number_encrypted: string | null } | null;
  };
  const receipts: ReceiptRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("receipts")
      .select("receipt_code, issued_at, total_amount, resident_no_encrypted, members!inner(id, name, id_number_encrypted)")
      .eq("org_id", tenant.id)
      .eq("year", year)
      .or("status.is.null,status.eq.issued")
      .order("issued_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    receipts.push(...((data ?? []) as unknown as ReceiptRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }

  // 주민번호: 후원자 정보 우선, 없으면 예전 결제 시점 영수증에 남은 값
  const source: NtsSourceRow[] = [];
  for (const r of receipts) {
    const cipher = r.members?.id_number_encrypted ?? r.resident_no_encrypted;
    let donorId: string | null = null;
    if (cipher) {
      const { data: plain, error } = await supabase.rpc("decrypt_id_number", { ciphertext: cipher, passphrase: encKey });
      if (error) console.error(`[nts-export] 복호화 실패 receipt=${r.receipt_code}`); // 번호 자체는 로그에 남기지 않는다
      donorId = (plain as string | null) ?? null;
    }
    source.push({
      receiptCode: r.receipt_code,
      issuedAt: r.issued_at,
      donorName: r.members?.name ?? "",
      donorId,
      totalAmount: Number(r.total_amount ?? 0),
    });
  }

  const ds = buildNtsDataset(org, year, source);
  const blocking = ds.orgIssues.filter((i) => i.blocking);

  if (preview) {
    return NextResponse.json({
      year,
      rowCount: ds.rows.length,
      totalAmount: ds.totalAmount,
      excluded: ds.excluded,
      merged: ds.merged,
      orgIssues: ds.orgIssues,
      columns: NTS_COLUMNS.map((c) => c.header),
    });
  }

  if (blocking.length) {
    return NextResponse.json(
      { error: "기관 정보에 필수 기재사항이 없습니다. 기관 설정에서 입력해 주세요.", issues: blocking },
      { status: 422 },
    );
  }

  const o = { name: org.name ?? "", bizNo: (org.business_no ?? "").replace(/\D/g, ""), doneeCode: org.donee_code ?? "", typeCode: org.donation_type_code ?? "" };
  const xlsx = await buildXlsx(
    `${year}년 기부금 발급명세`,
    NTS_COLUMNS.map((c) => c.header),
    ds.rows.map((r) => NTS_COLUMNS.map((c) => c.value(r, o))),
  );

  // 감사·제출 이력은 서버에서(예전엔 클라이언트가 빈 fileUrl로 보내 400 → 기록이 한 번도 남지 않았다)
  await supabase.from("nts_export_logs").insert({
    org_id: tenant.id,
    year,
    created_by: adminUser.id,
    file_url: "download",
    member_count: ds.rows.length,
    total_amount: ds.totalAmount,
  });
  await logAudit({
    orgId: tenant.id,
    actorId: adminUser.id,
    actorEmail: adminUser.email ?? null,
    action: "receipt.nts_export",
    resourceType: "receipt",
    resourceId: null,
    summary: `${year}년 국세청 제출 자료 ${ds.rows.length}건 내려받기(제외 ${ds.excluded.length}건)`,
  });

  const body = xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nts_donation_${year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
