import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChargebackList, type ChargebackRow } from "@/components/admin/chargeback-list";

export const metadata = { title: "카드 결제 이의 제기" };

type DbRow = {
  id: string;
  amount: number;
  reason_code: string | null;
  reason_text: string | null;
  status: ChargebackRow["status"];
  toss_case_id: string | null;
  evidence_json: { notes?: ChargebackRow["notes"] } | null;
  created_at: string;
  closed_at: string | null;
  payments: {
    payment_code: string | null;
    members: { id: string; name: string | null; member_code: string | null } | null;
  } | null;
};

export default async function AdminChargebacksPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("chargebacks")
    .select(
      "id, amount, reason_code, reason_text, status, toss_case_id, evidence_json, created_at, closed_at, payments(payment_code, members(id, name, member_code))",
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: ChargebackRow[] = ((data as unknown as DbRow[]) ?? []).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    reason: r.reason_text ?? r.reason_code ?? "",
    status: r.status,
    tossCaseId: r.toss_case_id,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    paymentCode: r.payments?.payment_code ?? null,
    memberName: r.payments?.members?.name ?? null,
    memberCode: r.payments?.members?.member_code ?? null,
    memberId: r.payments?.members?.id ?? null,
    notes: Array.isArray(r.evidence_json?.notes) ? r.evidence_json!.notes! : [],
  }));

  return <ChargebackList rows={rows} />;
}
