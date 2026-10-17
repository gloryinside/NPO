import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { logAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstToday } from "@/lib/billing/kst";
import { generateNts637Pdf } from "@/lib/disclosure/nts-63-7-pdf";
import { parseYear } from "@/lib/disclosure/nts-63-7";
import { buildDraftFromRecords, loadSavedForm } from "@/lib/disclosure/nts-63-7-data";

/** GET /api/admin/disclosures/nts-63-7/pdf?year=2025 — 저장한 작성본(없으면 초안)을 서식 PDF로 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const y = parseYear(req.nextUrl.searchParams.get("year"));
  if (!y) return NextResponse.json({ error: "연도를 확인해 주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const form = (await loadSavedForm(supabase, tenant.id, y))?.form ?? (await buildDraftFromRecords(supabase, tenant.id, y, kstToday()));
  const pdf = await generateNts637Pdf(form);
  // 지급처에 개인(장학생 등) 이름이 들어갈 수 있어 내려받기를 기록한다
  await logAudit({
    orgId: tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: "admin.data_export",
    resourceType: "transparency_disclosure",
    resourceId: String(y),
    summary: `${y}년 기부금 모금액·활용실적 명세서 PDF 내려받기`,
  });
  const name = encodeURIComponent(`${y}_연간기부금모금액및활용실적명세서.pdf`);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
      "Cache-Control": "no-store",
    },
  });
}
