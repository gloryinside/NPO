import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { TaxInvoiceRow } from "./tax-invoice-row";

export const metadata = { title: "세금계산서 큐" };

const STATUS_LABEL: Record<string, string> = {
  pending: "발행 대기",
  issued: "발행 완료",
  sent: "전송 완료",
  cancelled: "취소",
};

type Row = {
  id: string;
  member_id: string;
  payment_id: string | null;
  business_reg_no: string;
  corp_legal_name: string;
  ceo_name: string | null;
  tax_invoice_email: string | null;
  amount: number;
  issue_date: string | null;
  invoice_no: string | null;
  status: string;
  external_provider: string | null;
  created_at: string;
  members: { name: string | null } | null;
};

export default async function TaxInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "pending";

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("tax_invoices")
    .select("id, member_id, payment_id, business_reg_no, corp_legal_name, ceo_name, tax_invoice_email, amount, issue_date, invoice_no, status, external_provider, created_at, members(name)")
    .eq("org_id", tenant.id)
    .eq("status", filter)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="세금계산서 큐"
        description="법인 후원자(tax_invoice_required=true)의 결제에 대해 발행 대기·완료를 추적합니다."
      />

      <div className="flex gap-2 text-sm">
        {(["pending", "issued", "sent", "cancelled"] as const).map((s) => (
          <Link key={s} href={`/admin/tax-invoices?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}>
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          해당 상태의 세금계산서가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => <TaxInvoiceRow key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}
