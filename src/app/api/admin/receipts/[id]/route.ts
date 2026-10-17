import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { checkCsrf } from "@/lib/security/csrf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyReceiptIssued } from "@/lib/notifications/send";
import { kstParts } from "@/lib/billing/kst";
import { collectYearDonations, issueReceipt, loadOrgForReceipt, RECEIPT_BUCKET } from "@/lib/receipt/issue";

// Next.js 16: 같은 부모 아래 서로 다른 slug 이름 금지 — [id] 값은 member.id
type RouteContext = { params: Promise<{ id: string }> };

/**
 * /api/admin/receipts/[id]   ([id] = member.id)
 *
 * GET  ?year=2026            — 이미 발급된 유효 영수증 PDF 내려받기만(상태 변경 없음)
 * POST { year, reissue? }    — 발급(멱등: 유효본이 있으면 그것) / reissue=true면 새 번호로 재발급·이전본 취소
 *
 * 예전엔 GET이 발급·재발급까지 해서, 다른 사이트의 링크·이미지 태그로도 관리자 브라우저가 발급을 일으킬 수 있었다(CSRF).
 * 발급 규칙은 lib/receipt/issue 공통. 기관 법정 기재사항이 비면 422와 누락 항목.
 */
type Ctx = { tenantId: string; memberId: string; year: number };

async function resolve(params: RouteContext["params"], yearRaw: unknown) {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 400 }) };
  }
  const { id: memberId } = await params;
  const year = yearRaw === undefined || yearRaw === null || yearRaw === "" ? kstParts().year : Number(yearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return { error: NextResponse.json({ error: "year가 유효하지 않습니다." }, { status: 400 }) };
  }
  return { ctx: { tenantId: tenant.id, memberId, year } satisfies Ctx };
}

async function downloadExisting(supabase: ReturnType<typeof createSupabaseAdminClient>, c: Ctx, receiptCode: string) {
  const { data: file, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .download(`${c.tenantId}/${c.year}/${receiptCode}.pdf`);
  if (error || !file) {
    return NextResponse.json(
      { error: "발급된 영수증 파일을 찾을 수 없습니다. 재발급으로 다시 만들 수 있습니다." },
      { status: 404 },
    );
  }
  return pdfResponse(Buffer.from(await file.arrayBuffer()), receiptCode);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();
  const r = await resolve(params, new URL(req.url).searchParams.get("year"));
  if ("error" in r) return r.error;
  const c = r.ctx;

  const supabase = createSupabaseAdminClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("receipt_code")
    .eq("org_id", c.tenantId)
    .eq("member_id", c.memberId)
    .eq("year", c.year)
    .or("status.is.null,status.eq.issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!receipt) return NextResponse.json({ error: "발급된 영수증이 없습니다." }, { status: 404 });
  return downloadExisting(supabase, c, receipt.receipt_code as string);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const adminUser = await requireAdminUser();
  const body = (await req.json().catch(() => ({}))) as { year?: unknown; reissue?: unknown };
  const r = await resolve(params, body.year);
  if ("error" in r) return r.error;
  const c = r.ctx;
  const reissue = body.reissue === true;

  const supabase = createSupabaseAdminClient();
  const org = await loadOrgForReceipt(supabase, c.tenantId);
  if (!org) return NextResponse.json({ error: "기관 정보를 찾을 수 없습니다." }, { status: 404 });

  const { data: member } = await supabase
    .from("members")
    .select("id, name, phone, email")
    .eq("id", c.memberId)
    .eq("org_id", c.tenantId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "후원자를 찾을 수 없습니다." }, { status: 404 });

  // 관리자 단건 발급은 영수증 신청 여부와 무관(후원자가 따로 요청한 경우)
  const donations = await collectYearDonations(supabase, c.tenantId, c.year, {
    memberIds: [c.memberId],
    requireOptIn: false,
  });
  const result = await issueReceipt(supabase, {
    org,
    memberId: c.memberId,
    year: c.year,
    donations: donations.get(c.memberId),
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
    case "existing":
      return downloadExisting(supabase, c, result.receiptCode);
    case "issued":
      notifyReceiptIssued({
        orgId: c.tenantId,
        phone: member.phone ?? null,
        email: member.email ?? null,
        name: member.name,
        year: c.year,
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
