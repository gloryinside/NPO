import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "모금 채널" };

const TYPE_LABEL: Record<string, string> = {
  box: "모금함",
  street: "거리모금",
  booth: "부스",
  online: "온라인",
  partner: "파트너",
  other: "기타",
};

type Row = {
  id: string;
  code: string;
  name: string;
  channel_type: string;
  location: string | null;
  manager_name: string | null;
  active_from: string | null;
  active_to: string | null;
  active: boolean;
};

export default async function DonationChannelsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("donation_channels")
    .select("id, code, name, channel_type, location, manager_name, active_from, active_to, active")
    .eq("org_id", tenant.id)
    .order("name");

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="외부 모금 채널"
        description="모금함·거리모금·부스·파트너 등 채널을 정의하고 정산을 추적합니다."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 채널이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["코드", "이름", "유형", "위치", "담당자", "활성"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{c.code}</td>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/donation-channels/${c.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[c.channel_type]}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.location ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.manager_name ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: c.active ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {c.active ? "활성" : "비활성"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 채널</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/donation-channels"
              fields={[
                { name: "code", label: "채널 코드", required: true, placeholder: "box-myeongdong-01" },
                { name: "name", label: "이름", required: true },
                {
                  name: "channelType", label: "유형", type: "select", required: true,
                  options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "location", label: "위치" },
                { name: "managerName", label: "담당자" },
                { name: "managerPhone", label: "담당자 연락처" },
                { name: "activeFrom", label: "활성 시작일", type: "date" },
                { name: "activeTo", label: "활성 종료일", type: "date" },
              ]}
              submitLabel="채널 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
