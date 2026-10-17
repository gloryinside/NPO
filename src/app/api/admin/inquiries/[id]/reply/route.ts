import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";

type RouteParams = Promise<{ id: string }>;

// POST /api/admin/inquiries/[id]/reply — 관리자 답변 등록
export async function POST(req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject<{ body?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const replyText = typeof body.body === "string" ? body.body.trim() : "";
  if (!replyText || replyText.length > 3000)
    return NextResponse.json({ error: "답변 내용을 입력해주세요. (3000자 이하)" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // 문의 존재·소속 확인
  const { data: inquiryRaw, error: fetchErr } = await admin
    .from("inquiries")
    .select("id, subject, status, member_id, members(name, email)")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!inquiryRaw) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  const inquiry = inquiryRaw as unknown as {
    id: string;
    subject: string;
    status: string;
    member_id: string;
    members: { name: string | null; email: string | null } | null;
  };

  const now = new Date().toISOString();

  // 답변 저장
  const { error: replyErr } = await admin.from("inquiry_replies").insert({
    inquiry_id: id,
    org_id: tenant.id,
    author_role: "admin",
    body: replyText,
  });
  if (replyErr) return NextResponse.json({ error: replyErr.message }, { status: 500 });

  // 문의 상태 → answered
  await admin
    .from("inquiries")
    .update({ status: "answered", answered_at: now, updated_at: now })
    .eq("id", id);

  // 후원자 이메일 알림 (best-effort)
  const member = inquiry.members;
  if (member?.email) {
    const orgName = tenant.name ?? "후원 기관";
    await sendEmail({
      to: member.email,
      subject: `[${orgName}] 문의 답변이 등록되었습니다`,
      html: `
        <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
          <h2 style="font-size:18px;margin:0 0 12px;">${member.name ?? "후원자"}님의 문의에 답변이 달렸습니다</h2>
          <p style="color:#6b7280;font-size:14px;">문의 제목: <b style="color:#111827;">${inquiry.subject}</b></p>
          <div style="background:#f9fafb;border-left:3px solid #6366f1;padding:12px 16px;margin:16px 0;font-size:14px;">
            ${replyText.replace(/\n/g, "<br/>")}
          </div>
          <p style="font-size:13px;color:#6b7280;">포털에서 전체 대화를 확인하실 수 있습니다.</p>
        </div>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
