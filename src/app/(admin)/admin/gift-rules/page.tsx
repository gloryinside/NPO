import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "기념품 룰" };

const TRIGGER_LABEL: Record<string, string> = {
  cumulative_amount: "누적 후원금",
  years_active: "지속 기간(년)",
  single_payment: "단건 결제 금액",
};

type Rule = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: number;
  gift_name: string;
  gift_description: string | null;
  active: boolean;
};

export default async function GiftRulesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("gift_rules")
    .select("id, name, trigger_type, trigger_value, gift_name, gift_description, active")
    .eq("org_id", tenant.id)
    .order("trigger_value");

  const rows = (data as unknown as Rule[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="기념품 룰"
        description="후원자가 누적 N원/N년 등 조건 달성 시 자동으로 발송 큐에 추가되는 트리거 정의."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 룰이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["룰 이름", "트리거", "임계값", "기념품", "활성"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TRIGGER_LABEL[r.trigger_type]}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        {r.trigger_type === "years_active"
                          ? `${r.trigger_value}년`
                          : `${Number(r.trigger_value).toLocaleString("ko-KR")}원`}
                      </td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.gift_name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: r.active ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {r.active ? "활성" : "비활성"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 룰</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/gift-rules"
              fields={[
                { name: "name", label: "룰 이름", required: true, placeholder: "100만원 누적 감사품" },
                {
                  name: "triggerType", label: "트리거", type: "select", required: true,
                  options: Object.entries(TRIGGER_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "triggerValue", label: "임계값", type: "number", required: true, min: 0,
                  helpText: "누적/단건은 원 단위, 지속기간은 년 단위" },
                { name: "giftName", label: "기념품명", required: true, placeholder: "머그컵 + 감사장" },
                { name: "giftDescription", label: "기념품 설명", type: "textarea", rows: 2 },
                { name: "thankMessage", label: "감사 메시지", type: "textarea", rows: 3 },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="룰 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
