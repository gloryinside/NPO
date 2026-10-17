import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { ShipmentRow } from "./shipment-row";

export const metadata = { title: "기념품 발송" };

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  preparing: "준비중",
  shipped: "발송완료",
  skipped: "제외",
};

type Row = {
  id: string;
  member_id: string;
  gift_name: string;
  trigger_value: number | null;
  status: string;
  shipping_address: string | null;
  tracking_no: string | null;
  shipped_at: string | null;
  notes: string | null;
  created_at: string;
  members: { name: string | null; phone: string | null; email: string | null; address_full: string | null } | null;
};

export default async function GiftShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "queued";

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("gift_shipments")
    .select("id, member_id, gift_name, trigger_value, status, shipping_address, tracking_no, shipped_at, notes, created_at, members(name, phone, email, address_full)")
    .eq("org_id", tenant.id)
    .eq("status", filter)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="감사 선물 발송"
        description="자동 큐에 들어온 발송 건을 처리합니다. 룰은 '기념품 룰 설정'에서 관리하세요."
      />

      <div className="flex gap-2 text-sm">
        {(["queued", "preparing", "shipped", "skipped"] as const).map((s) => (
          <Link key={s} href={`/admin/gift-shipments?status=${s}`}
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
          해당 상태의 발송 건이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ShipmentRow key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
