import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "물품기부" };

const STATUS_LABEL: Record<string, string> = {
  pending: "접수",
  appraised: "평가완료",
  accepted: "수락",
  rejected: "반려",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warning)",
  appraised: "var(--info)",
  accepted: "var(--positive)",
  rejected: "var(--negative)",
};

type Row = {
  id: string;
  donor_name: string | null;
  item_name: string;
  category: string | null;
  quantity: number;
  estimated_value: number | null;
  appraised_value: number | null;
  status: string;
  received_at: string | null;
  created_at: string;
  members: { name: string | null } | null;
};

export default async function InKindPage({
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
    .from("in_kind_donations")
    .select(
      "id, donor_name, item_name, category, quantity, estimated_value, appraised_value, status, received_at, created_at, members(name)"
    )
    .eq("org_id", tenant.id)
    .eq("status", filter)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="물품기부"
        description="현금이 아닌 물품 기부의 접수→평가→수락/반려 워크플로."
      />

      <div className="flex gap-2 text-sm">
        {(["pending", "appraised", "accepted", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/in-kind?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              내역이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["기부자", "물품", "카테고리", "수량", "추정가", "평가가", "상태"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        <Link href={`/admin/in-kind/${r.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {r.members?.name ?? r.donor_name ?? "익명"}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.item_name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.category ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.quantity}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {r.estimated_value != null ? `${Number(r.estimated_value).toLocaleString("ko-KR")}원` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>
                        {r.appraised_value != null ? `${Number(r.appraised_value).toLocaleString("ko-KR")}원` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: STATUS_COLOR[r.status] }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 접수</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/in-kind"
              fields={[
                { name: "itemName", label: "물품명", required: true },
                { name: "donorName", label: "기부자(비회원)" },
                { name: "memberId", label: "회원 ID(있을 경우)" },
                { name: "category", label: "카테고리", placeholder: "의류·식품·도서·기타" },
                { name: "quantity", label: "수량", type: "number", min: 1, defaultValue: 1 },
                { name: "estimatedValue", label: "추정가액(원)", type: "number", min: 0 },
                { name: "receivedAt", label: "수령일", type: "date" },
                { name: "description", label: "설명", type: "textarea" },
              ]}
              submitLabel="접수 등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
