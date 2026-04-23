import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * G-D04: 후원자 본인 영수증 일괄 다운로드 (ZIP)
 *
 * GET /api/donor/receipts/export?year=2026
 *  - year 생략 시 가장 최근 연도 하나
 *  - 해당 연도의 본인 영수증 PDF를 모두 ZIP으로 묶어 반환
 *  - PDF 미생성(pdf_url=null)인 영수증은 제외 + 매니페스트에 표시
 *  - Rate limit: 분당 5회 (파일이 크므로 receipts/download 보다 낮게)
 */
export async function GET(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(
    `receipts:export:${session.member.id}`,
    5,
    60_000
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isFinite(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: "유효하지 않은 연도" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("receipts")
    .select("id, receipt_code, year, total_amount, pdf_url, issued_at")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("year", { ascending: false })
    .order("issued_at", { ascending: false });

  if (year !== null) {
    query = query.eq("year", year);
  } else {
    // 최신 연도만
    const { data: latest } = await supabase
      .from("receipts")
      .select("year")
      .eq("org_id", session.member.org_id)
      .eq("member_id", session.member.id)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) {
      return NextResponse.json(
        { error: "발급된 영수증이 없습니다." },
        { status: 404 }
      );
    }
    query = query.eq("year", latest.year as number);
  }

  const { data: receipts } = await query;
  const rows =
    (receipts as {
      id: string;
      receipt_code: string;
      year: number;
      total_amount: number;
      pdf_url: string | null;
      issued_at: string | null;
    }[]) ?? [];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "해당 연도 영수증이 없습니다." },
      { status: 404 }
    );
  }

  // G-D59: 메모리 보호 — 한 번에 200건 이상은 분할 요청 유도
  const MAX_ROWS = 200;
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `영수증이 너무 많습니다 (${rows.length}건). 연도별 또는 분기별로 나눠서 요청해주세요.`,
        code: "TOO_MANY_RECEIPTS",
        max: MAX_ROWS,
      },
      { status: 413 }
    );
  }

  const zip = new JSZip();
  const targetYear = rows[0].year;
  const folder = zip.folder(`영수증_${targetYear}`) ?? zip;

  const manifestLines: string[] = [
    `기부금 영수증 일괄 다운로드 — ${targetYear}년`,
    `후원자: ${session.member.name}`,
    `생성일시: ${new Date().toLocaleString("ko-KR")}`,
    "",
    "영수증 목록:",
  ];

  let included = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.pdf_url) {
      skipped++;
      manifestLines.push(
        `  - [건너뜀] ${r.receipt_code} : PDF 미생성`
      );
      continue;
    }
    const storagePath = `${session.member.org_id}/${r.year}/${r.receipt_code}.pdf`;
    const { data: blob, error } = await supabase.storage
      .from("receipts")
      .download(storagePath);
    if (error || !blob) {
      skipped++;
      manifestLines.push(
        `  - [실패] ${r.receipt_code} : 스토리지 접근 오류`
      );
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    folder.file(`${r.receipt_code}.pdf`, buf);
    manifestLines.push(
      `  ✓ ${r.receipt_code} (${new Intl.NumberFormat("ko-KR").format(
        r.total_amount
      )}원)`
    );
    included++;
  }

  if (included === 0) {
    return NextResponse.json(
      { error: "다운로드 가능한 PDF가 없습니다." },
      { status: 404 }
    );
  }

  manifestLines.push("", `총 ${included}건 포함 / ${skipped}건 제외`);
  folder.file("README.txt", manifestLines.join("\n"));

  const zipBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const filename = `receipts_${targetYear}.zip`;
  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
