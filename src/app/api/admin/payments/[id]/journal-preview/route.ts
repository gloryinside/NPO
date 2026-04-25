import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildJournalPreview } from "@/lib/erp/journal-builder";

/**
 * GET /api/admin/payments/[id]/journal-preview
 *   payment 한 건의 분개 미리보기 + warnings.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const preview = await buildJournalPreview(supabase, tenant.id, id);
  return NextResponse.json(preview);
}
