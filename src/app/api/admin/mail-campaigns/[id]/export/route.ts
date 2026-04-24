import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { resolveSegment, type SegmentFilter } from "@/lib/mail/segment-resolver";

/**
 * POST /api/admin/mail-campaigns/[id]/export
 *   세그먼트 필터로 명단 추출 → mail_dispatches 일괄 INSERT + CSV 응답.
 *   campaign.status='exported' 로 전환.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase
    .from("mail_campaigns")
    .select("id, name, status, segment_filter")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (campaign.status !== "planning") {
    return NextResponse.json(
      { error: `이미 ${campaign.status} 상태` },
      { status: 400 }
    );
  }

  const filter = (campaign.segment_filter ?? {}) as SegmentFilter;
  const recipients = await resolveSegment(supabase, tenant.id, filter);

  // 발송 이력 행 일괄 INSERT (UNIQUE 위반은 무시 — 동일 캠페인 재export 방지)
  if (recipients.length > 0) {
    const dispatches = recipients.map((r) => ({
      org_id: tenant.id,
      campaign_id: id,
      member_id: r.memberId,
      snapshot_address: r.address,
      status: "pending" as const,
    }));
    await supabase.from("mail_dispatches").insert(dispatches);
  }

  await supabase
    .from("mail_campaigns")
    .update({
      status: "exported",
      recipient_count: recipients.length,
      exported_at: new Date().toISOString(),
      exported_by: user.id,
    })
    .eq("id", id)
    .eq("org_id", tenant.id);

  // CSV 생성 (우체국 라벨 양식: 이름, 주소, 등급, 누적후원금)
  const header = "name,address,tier,total_paid";
  const rows = recipients.map((r) => {
    const safe = (s: string) =>
      `"${(s ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    return [safe(r.name), safe(r.address), safe(r.tier ?? ""), r.totalPaid].join(",");
  });
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mail-${id}.csv"`,
    },
  });
}
