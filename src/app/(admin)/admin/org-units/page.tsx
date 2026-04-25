import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "조직 단위" };

type Unit = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  manager_email: string | null;
  active: boolean;
};

export default async function OrgUnitsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: units } = await supabase
    .from("org_units")
    .select("id, code, name, parent_id, manager_email, active")
    .eq("org_id", tenant.id)
    .order("code");

  const list = (units as Unit[]) ?? [];
  const parentMap = new Map(list.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="조직 단위 (지부/본부)"
        description="조직을 본부/지부로 나누어 데이터 접근을 격리합니다. admin_user.unit_scope로 범위 결정."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {list.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 조직 단위가 없습니다. 먼저 본부(HQ)를 생성하고 그 아래로 지부를 추가하세요.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["코드", "이름", "상위", "담당자", "활성"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{u.code}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{u.name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {u.parent_id ? (parentMap.get(u.parent_id) ?? "?") : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{u.manager_email ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: u.active ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {u.active ? "활성" : "비활성"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 조직 단위</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/org-units"
              fields={[
                { name: "code", label: "코드", required: true, placeholder: "HQ, SEOUL, BUSAN" },
                { name: "name", label: "이름", required: true, placeholder: "본부 / 서울지부 / 부산지부" },
                {
                  name: "parentId", label: "상위 단위", type: "select",
                  options: list.map((u) => ({ value: u.id, label: `${u.code} ${u.name}` })),
                  helpText: "본부는 비워두기",
                },
                { name: "managerEmail", label: "담당자 이메일" },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="단위 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
