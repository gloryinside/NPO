import { NextRequest, NextResponse } from "next/server";
import iconv from "iconv-lite";
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
 *   - 귀속연도별 명세 변경 가능성 (매년 확인)
 *   - 기부자 관계(배우자/부양가족) 필드 추가 여부
 *   - 지정/비지정 기부금 구분 코드
 *   - 사업자번호/주민번호 체크섬 검증
 *   - 현재 구현은 2024년 기준 100바이트 H/D/T 레코드로 최소 필드만 포함.
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
       members!inner(id, name, id_number_encrypted, phone)`
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
      id_number_encrypted: string | null;
      phone: string | null;
    } | null;
  };

  const receipts = (receiptsRaw as unknown as ReceiptRow[]) ?? [];

  // 주민번호 복호화 키
  const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
  if (!encKey) {
    return NextResponse.json(
      { error: "주민번호 복호화 키(RECEIPTS_ENCRYPTION_KEY)가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

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

    // 암호화된 주민번호 복호화 (없으면 건너뜀 — 국세청 제출 불가)
    if (!member.id_number_encrypted) continue;
    const { data: decrypted, error: decErr } = await supabase.rpc(
      "decrypt_id_number",
      { ciphertext: member.id_number_encrypted, passphrase: encKey }
    );
    if (decErr) {
      console.error(
        `[nts-export] decrypt_id_number failed for member ${member.id}:`,
        decErr.message
      );
      continue;
    }
    const idNumber = ((decrypted as string | null) ?? "").replace(/-/g, "");
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

  // 4) 포맷 검증 — 모든 레코드는 정확히 100 바이트(EUC-KR) 여야 한다.
  const EXPECTED_LINE_LENGTH = 100;
  const formatErrors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const len = eucKrByteLength(lines[i]);
    if (len !== EXPECTED_LINE_LENGTH) {
      const type = lines[i][0];
      formatErrors.push(
        `레코드 ${i + 1} (타입=${type}) 길이 불일치: 기대=${EXPECTED_LINE_LENGTH}바이트, 실제=${len}바이트`
      );
    }
  }
  if (formatErrors.length > 0) {
    console.error("[nts-export] format validation failed:", formatErrors);
    return NextResponse.json(
      {
        error: "전산매체 파일 포맷 검증 실패",
        details: formatErrors,
      },
      { status: 500 }
    );
  }

  // EUC-KR 인코딩으로 최종 출력 (국세청 명세 준수)
  const text = lines.join("\r\n");
  const eucKrBuffer = iconv.encode(text, "euc-kr");
  const filename = `nts_donation_${year}_${submitDate}.txt`;

  return new NextResponse(new Uint8Array(eucKrBuffer), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=euc-kr",
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
 * 국세청 전산매체 명세에 맞춰 EUC-KR 바이트 기준 우측 공백 패딩.
 * 한글 한 글자 = 2바이트(EUC-KR). 길이 초과 시 바이트 단위 절단.
 */
function padEndKr(str: string, byteLen: number): string {
  const encoded = iconv.encode(str, "euc-kr");
  if (encoded.length >= byteLen) {
    // 정확히 byteLen 바이트로 절단. 한글 중간에 잘리면 마지막 바이트를 공백으로 치환.
    const truncated = encoded.subarray(0, byteLen);
    // 한글이 중간에 잘렸는지 확인: 마지막 바이트가 EUC-KR 고위 영역(0xA1-0xFE)이면
    // 짝이 안 맞을 수 있으므로 재디코딩 후 재인코딩.
    const reDecoded = iconv.decode(truncated, "euc-kr");
    const reEncoded = iconv.encode(reDecoded, "euc-kr");
    if (reEncoded.length === byteLen) return reDecoded;
    // 1바이트 부족하면 공백으로 패딩
    return reDecoded + " ".repeat(byteLen - reEncoded.length);
  }
  return str + " ".repeat(byteLen - encoded.length);
}

/** EUC-KR 바이트 길이 계산. */
function eucKrByteLength(str: string): number {
  return iconv.encode(str, "euc-kr").length;
}
