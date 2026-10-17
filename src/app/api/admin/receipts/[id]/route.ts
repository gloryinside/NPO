import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyReceiptIssued } from "@/lib/notifications/send";
import { kstParts } from "@/lib/billing/kst";
import { collectYearDonations, issueReceipt, loadOrgForReceipt, RECEIPT_BUCKET } from "@/lib/receipt/issue";

// Next.js 16: 같은 부모 아래 서로 다른 slug 이름 금지 — [id] 값은 member.id
type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/receipts/[id]?year=2026[&reissue=1]   ([id] = member.id)
 *
 * 해당 연도(KST) 기부금 영수증 PDF를 내려준다. 발급 규칙은 lib/receipt/issue 공통:
 *  - 이미 유효한 영수증이 있으면 새로 만들지 않고 그 PDF를 돌려준다(예전엔 호출마다 중복 발급).
 *  - reissue=1 이면 새 번호로 재발급하고 이전 영수증은 취소 처리한다.
 *  - 기관 법정 기재사항이 비면 422와 누락 항목을 돌려준다.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  const { id: memberId } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : kstParts().year;
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json({ error: "year 파라미터가 유효하지 않습니다." }, { status: 400 });
  }
  const reissue = url.searchParams.get("reissue") === "1";

  const supabase = createSupabaseAdminClient();
  const org = await loadOrgForReceipt(supabase, tenant.id);
  if (!org) return NextResponse.json({ error: "기관 정보를 찾을 수 없습니다." }, { status: 404 });

  const { data: member } = await supabase
    .from("members")
    .select("id, name, phone, email")
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "후원자를 찾을 수 없습니다." }, { status: 404 });

  // 관리자 단건 발급은 영수증 신청 여부와 무관(후원자가 따로 요청한 경우)
  const donations = await collectYearDonations(supabase, tenant.id, year, {
    memberIds: [memberId],
    requireOptIn: false,
  });
  const result = await issueReceipt(supabase, {
    org,
    memberId,
    year,
    donations: donations.get(memberId),
    issuedBy: adminUser.id,
    reissue,
  });

  switch (result.kind) {
    case "blocked":
      return NextResponse.json(
        { error: "기관 정보에 영수증 필수 기재사항이 없습니다. 기관 설정에서 입력해 주세요.", issues: result.issues },
        { status: 422 },
      );
    case "no_donations":
      return NextResponse.json({ error: "해당 연도에 공제 대상 납입 내역이 없습니다." }, { status: 400 });
    case "failed":
      return NextResponse.json({ error: result.error }, { status: 500 });
    case "existing": {
      const { data: file, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .download(`${tenant.id}/${year}/${result.receiptCode}.pdf`);
      if (error || !file) {
        return NextResponse.json(
          { error: "발급된 영수증 파일을 찾을 수 없습니다. 재발급(reissue=1)으로 다시 만들 수 있습니다." },
          { status: 404 },
        );
      }
      return pdfResponse(Buffer.from(await file.arrayBuffer()), result.receiptCode);
    }
    case "issued":
      notifyReceiptIssued({
        orgId: tenant.id,
        phone: member.phone ?? null,
        email: member.email ?? null,
        name: member.name,
        year,
        pdfUrl: result.pdfUrl,
        orgName: org.name ?? "",
        receiptCode: result.receiptCode,
        totalAmount: result.total,
      });
      return pdfResponse(result.pdf, result.receiptCode);
  }
}

function pdfResponse(pdf: Buffer, receiptCode: string) {
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receiptCode}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
