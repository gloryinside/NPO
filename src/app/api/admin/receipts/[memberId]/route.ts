import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateReceiptCode } from "@/lib/codes";
import { generateReceiptPdf, type ReceiptData } from "@/lib/receipt/pdf";
import { notifyReceiptIssued } from '@/lib/notifications/send';

const RECEIPT_BUCKET = "receipts";

type RouteContext = { params: Promise<{ memberId: string }> };

type PaymentJoin = {
  amount: number;
  pay_date: string | null;
  campaigns: { title: string } | null;
};

type OrgRow = {
  id: string;
  name: string;
  business_no: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

/**
 * GET /api/admin/receipts/[memberId]?year=2026
 *
 * 해당 연도에 member 가 납입 완료(paid)한 결제들을 합산해 기부금 영수증 PDF 를 생성해
 * 다운로드로 반환한다. Supabase Storage 업로드는 Phase 2 로 미뤘으며, 본 엔드포인트는
 * receipts 행을 추적 목적으로 생성하되 pdf_url 없이 남긴다.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();

  const { memberId } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json(
      { error: "year 파라미터가 유효하지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 1) 기관 정보
  const { data: orgRaw, error: orgErr } = await supabase
    .from("orgs")
    .select("id, name, business_no, address, contact_phone, contact_email")
    .eq("id", tenant.id)
    .maybeSingle();
  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }
  if (!orgRaw) {
    return NextResponse.json(
      { error: "기관 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  const org = orgRaw as OrgRow;

  // 2) member 가 같은 테넌트 소속인지 확인 + 후원자 정보
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, name, phone, email, birth_date")
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json(
      { error: "후원자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 3) 해당 연도 납입 완료 결제
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const { data: paymentsRaw, error: payErr } = await supabase
    .from("payments")
    .select("amount, pay_date, campaigns(title)")
    .eq("org_id", tenant.id)
    .eq("member_id", memberId)
    .eq("pay_status", "paid")
    .gte("pay_date", yearStart)
    .lt("pay_date", yearEnd)
    .order("pay_date", { ascending: true });
  if (payErr) {
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }

  const payments = (paymentsRaw as unknown as PaymentJoin[]) ?? [];
  if (payments.length === 0) {
    return NextResponse.json(
      { error: "해당 연도에 납입 내역이 없습니다." },
      { status: 400 }
    );
  }

  const totalAmount = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );

  // 4) 영수증 코드 생성 — 이 기관+연도의 기존 receipts 수 +1
  const { count: existingCount, error: countErr } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .eq("year", year);
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  const receiptCode = generateReceiptCode(year, (existingCount ?? 0) + 1);

  const issuedAt = new Date().toISOString();

  // 5) PDF 생성
  const data: ReceiptData = {
    receiptCode,
    year,
    org: {
      name: org.name,
      businessNo: org.business_no,
      address: org.address,
      contactPhone: org.contact_phone,
      contactEmail: org.contact_email,
    },
    member: {
      name: member.name,
      phone: member.phone,
      birthDate: member.birth_date,
    },
    totalAmount,
    payments: payments.map((p) => ({
      payDate: p.pay_date ?? "",
      campaignTitle: p.campaigns?.title ?? null,
      amount: Number(p.amount) || 0,
    })),
    issuedAt,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReceiptPdf(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 6) Supabase Storage 업로드 → 서명된 URL 획득
  const storagePath = `${tenant.id}/${year}/${receiptCode}.pdf`;
  let pdfUrl: string | null = null;

  const { error: uploadErr } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[receipts] storage upload failed:", uploadErr.message);
    // 업로드 실패해도 PDF 다운로드는 제공하되 pdf_url 은 null 로 남긴다.
  } else {
    // 1년짜리 서명 URL (60 * 60 * 24 * 365 seconds)
    const { data: signedData, error: signErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    if (signErr) {
      console.error("[receipts] createSignedUrl failed:", signErr.message);
    } else {
      pdfUrl = signedData.signedUrl;
    }
  }

  // 7) receipts 행 생성 (pdf_url 포함)
  const { error: insertErr } = await supabase.from("receipts").insert({
    org_id: tenant.id,
    receipt_code: receiptCode,
    member_id: memberId,
    year,
    total_amount: totalAmount,
    pdf_url: pdfUrl,
    issued_at: issuedAt,
    issued_by: adminUser.id,
  });
  if (insertErr) {
    console.error("[receipts] failed to insert tracking row:", insertErr);
  }

  // 8) Email notification to donor (fire-and-forget)
  const memberEmail = (member as unknown as { email?: string | null }).email;
  notifyReceiptIssued({
    orgId: tenant.id,
    phone: member.phone ?? null,
    email: memberEmail ?? null,
    name: member.name,
    year,
    pdfUrl,
    orgName: org.name,
    receiptCode,
    totalAmount,
  });

  // Node Buffer → ArrayBuffer slice (Next.js Response BodyInit compatible).
  const body = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receiptCode}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
