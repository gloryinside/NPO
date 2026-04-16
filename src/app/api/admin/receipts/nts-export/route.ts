import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/receipts/nts-export?year=YYYY
 *
 * 국세청 연말정산 간소화 기부금 전산매체 파일 생성
 * 고정길이 텍스트 파일 (EUC-KR 기준 명세, UTF-8 인코딩으로 반환)
 *
 * 레코드 구조:
 *  H (헤더): 1건 — 제출기관 정보
 *  D (데이터): N건 — 기부자별 기부금 내역
 *  T (트레일러): 1건 — 합계
 *
 * ⚠️ 실제 국세청 제출 전 관할 세무서/홈택스 기술명세 최종 확인 필요.
 */
export async function GET(req: NextRequest) {
  await requireAdminUser();

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear() - 1;

  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json(
      { error: "year 파라미터가 유효하지 않습니다." },
      { status: 400 }
    );
  }

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 1) 기관 정보
  const { data: org } = await supabase
    .from("orgs")
    .select("name, business_no, address")
    .eq("id", tenant.id)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "기관 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 2) 해당 연도 발급된 receipts 조회 (member 정보 join)
  const { data: receiptsRaw, error: receiptsErr } = await supabase
    .from("receipts")
    .select(
      `id, receipt_code, year, total_amount, issued_at,
       members!inner(id, name, id_number, phone)`
    )
    .eq("org_id", tenant.id)
    .eq("year", year)
    .order("issued_at", { ascending: true });

  if (receiptsErr) {
    return NextResponse.json({ error: receiptsErr.message }, { status: 500 });
  }

  type ReceiptRow = {
    id: string;
    receipt_code: string;
    year: number;
    total_amount: number;
    issued_at: string | null;
    members: {
      id: string;
      name: string;
      id_number: string | null;
      phone: string | null;
    } | null;
  };

  const receipts = (receiptsRaw as unknown as ReceiptRow[]) ?? [];

  // 3) 전산파일 생성
  const lines: string[] = [];

  // ── 헤더 레코드 (H) ──────────────────────────────────────────────────────
  // 사업자번호(10), 기관명(40), 귀속연도(4), 레코드구분(1), 제출일자(8), 공백(37)
  const businessNo = (org.business_no ?? "").replace(/-/g, "").padEnd(10);
  const orgName = padEndKr(org.name ?? "", 40);
  const submitDate = toDateStr(new Date());
  const header = [
    "H",
    businessNo,
    orgName,
    String(year),
    submitDate,
    " ".repeat(37),
  ].join("");
  lines.push(header);

  // ── 데이터 레코드 (D) ──────────────────────────────────────────────────────
  let totalDonation = 0;
  let dataCount = 0;

  for (const r of receipts) {
    const member = r.members;
    if (!member) continue;

    // 주민번호 없으면 건너뜀 (국세청 제출 불가)
    const idNumber = (member.id_number ?? "").replace(/-/g, "");
    if (!idNumber || idNumber.length !== 13) continue;

    const donorName = padEndKr(member.name ?? "", 20);
    const amount = Number(r.total_amount ?? 0);
    totalDonation += amount;
    dataCount++;

    // 레코드구분(1), 사업자번호(10), 기부자주민번호(13), 기부자명(20),
    // 기부금액(15, 우측정렬), 귀속연도(4), 영수증번호(20), 공백(17)
    const dataLine = [
      "D",
      businessNo,
      idNumber,
      donorName,
      String(amount).padStart(15, "0"),
      String(year),
      r.receipt_code.padEnd(20),
      " ".repeat(17),
    ].join("");
    lines.push(dataLine);
  }

  // ── 트레일러 레코드 (T) ───────────────────────────────────────────────────
  // 레코드구분(1), 사업자번호(10), 총건수(10), 총금액(20), 공백(59)
  const trailer = [
    "T",
    businessNo,
    String(dataCount).padStart(10, "0"),
    String(totalDonation).padStart(20, "0"),
    " ".repeat(59),
  ].join("");
  lines.push(trailer);

  const content = lines.join("\r\n");
  const filename = `nts_donation_${year}_${submitDate}.txt`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-NTS-Year": String(year),
      "X-NTS-Count": String(dataCount),
      "X-NTS-Total": String(totalDonation),
    },
  });
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

/** YYYYMMDD 형태 날짜 문자열 */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

/**
 * 한글 포함 문자열을 바이트 기준이 아닌 문자 수 기준으로 우측 패딩.
 * 실제 EUC-KR 고정길이 파일에선 바이트 단위 패딩이 필요하지만
 * 여기서는 UTF-8 텍스트 반환이므로 문자 수 기준으로 처리.
 */
function padEndKr(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}
