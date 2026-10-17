import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "기업 매칭 프로그램" };

type Row = {
  id: string;
  name: string;
  match_ratio: number;
  per_donor_annual_cap: number | null;
  total_annual_cap: number | null;
  active: boolean;
  contact_email: string | null;
  members: { name: string | null } | null;
};

export default async function MatchingProgramsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [programsRes, corporateRes] = await Promise.all([
    supabase.from("matching_programs")
      .select("id, name, match_ratio, per_donor_annual_cap, total_annual_cap, active, contact_email, members(name)")
      .eq("org_id", tenant.id).order("name"),
    supabase.from("members").select("id, name")
      .eq("org_id", tenant.id).eq("member_type", "corporate").order("name"),
  ]);

  const rows = (programsRes.data as unknown as Row[]) ?? [];
  const corporates = (corporateRes.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="기업 매칭 프로그램"
        description="기업이 직원의 기부를 매칭하는 프로그램. 직원 신청 → 기업 승인 → 매칭 결제 흐름."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 프로그램이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["프로그램", "기업", "배율", "1인 한도", "전체 한도", "활성"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{p.name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{p.members?.name ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{Number(p.match_ratio)}배</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(p.per_donor_annual_cap)}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(p.total_annual_cap)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: p.active ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {p.active ? "활성" : "비활성"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 프로그램</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/matching-programs"
              fields={[
                { name: "name", label: "프로그램명", required: true, placeholder: "삼성전자 매칭" },
                {
                  name: "corporateMemberId", label: "기업 회원", type: "select", required: true,
                  options: corporates.map((c) => ({ value: c.id, label: c.name })),
                  helpText: "법인 회원만 선택 가능",
                },
                { name: "matchRatio", label: "매칭 배율 (1:1=1, 2:1=2)", type: "number", required: true, step: "0.1", min: 0.1, defaultValue: 1 },
                { name: "perDonorAnnualCap", label: "직원 1인 연간 한도(원)", type: "number", min: 0 },
                { name: "totalAnnualCap", label: "프로그램 전체 연간 한도(원)", type: "number", min: 0 },
                { name: "contactEmail", label: "기업 담당자 이메일" },
                { name: "activeFrom", label: "활성 시작", type: "date" },
                { name: "activeTo", label: "활성 종료", type: "date" },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="프로그램 등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
