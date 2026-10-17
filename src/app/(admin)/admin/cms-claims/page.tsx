import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listClaimablePayments } from "@/lib/cms/claim";
import { kstParts } from "@/lib/billing/kst";
import { CmsClaimBoard, type ClaimFileRow } from "@/components/admin/cms-claim-board";

export const metadata = { title: "자동이체(CMS) 청구" };

function todayKst() {
  const { year, month, day } = kstParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default async function CmsClaimsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { date } = await searchParams;
  const claimDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKst();

  const [claimable, filesRes] = await Promise.all([
    listClaimablePayments(supabase, tenant.id, claimDate),
    supabase
      .from("cms_claim_files")
      .select("id, filename, claim_date, payment_count, total_amount, status, success_count, fail_count, created_at")
      .eq("org_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const files: ClaimFileRow[] = (filesRes.data ?? []).map((f) => ({
    id: f.id as string,
    filename: f.filename as string,
    claimDate: f.claim_date as string,
    count: Number(f.payment_count),
    total: Number(f.total_amount),
    status: f.status as ClaimFileRow["status"],
    successCount: f.success_count as number | null,
    failCount: f.fail_count as number | null,
  }));

  return <CmsClaimBoard key={claimDate} claimDate={claimDate} claimable={claimable} files={files} />;
}
