import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "결연 매칭" };

const STATUS_LABEL: Record<string, string> = {
  active: "진행중",
  paused: "일시정지",
  ended: "종료",
};

type Row = {
  id: string;
  start_date: string;
  end_date: string | null;
  monthly_amount: number | null;
  status: string;
  members: { name: string | null } | null;
  beneficiaries: { code: string | null; name: string | null } | null;
};

export default async function SponsorshipsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [sponsorshipsRes, availBeneRes] = await Promise.all([
    supabase.from("sponsorships")
      .select("id, start_date, end_date, monthly_amount, status, members(name), beneficiaries(code, name)")
      .eq("org_id", tenant.id).order("start_date", { ascending: false }).limit(300),
    supabase.from("beneficiaries").select("id, code, name")
      .eq("org_id", tenant.id).in("status", ["available", "sponsored"]).order("code"),
  ]);

  const rows = (sponsorshipsRes.data as unknown as Row[]) ?? [];
  const beneficiaries = ((availBeneRes.data ?? []) as Array<{ id: string; code: string; name: string }>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="결연 매칭"
        description="후원자(member) ↔ 수혜자(beneficiary) 매칭. 다대다 가능."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              결연이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["후원자", "수혜자", "시작", "종료", "월 약정", "상태"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/sponsorships/${s.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {s.members?.name ?? "-"}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        {s.beneficiaries?.name ?? "-"}
                        {s.beneficiaries?.code && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{s.beneficiaries.code}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.start_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.end_date ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        {s.monthly_amount != null ? `${Number(s.monthly_amount).toLocaleString("ko-KR")}원` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[s.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">결연 매칭</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/sponsorships"
              fields={[
                { name: "sponsorMemberId", label: "후원자 회원 ID", required: true,
                  helpText: "회원 관리 페이지에서 ID를 복사해 입력" },
                {
                  name: "beneficiaryId", label: "수혜자", type: "select", required: true,
                  options: beneficiaries.map((b) => ({ value: b.id, label: `${b.code} ${b.name}` })),
                },
                { name: "startDate", label: "시작일", type: "date",
                  defaultValue: new Date().toISOString().slice(0, 10) },
                { name: "monthlyAmount", label: "월 약정금(원)", type: "number", min: 0 },
                { name: "promiseId", label: "연결 정기약정 ID" },
                { name: "notes", label: "메모", type: "textarea", rows: 2 },
              ]}
              submitLabel="결연 등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
