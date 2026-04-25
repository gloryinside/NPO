import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "수혜자 관리" };

const STATUS_LABEL: Record<string, string> = {
  available: "결연 대기",
  sponsored: "결연중",
  graduated: "졸업",
  withdrawn: "철회",
};
const STATUS_COLOR: Record<string, string> = {
  available: "var(--info)",
  sponsored: "var(--positive)",
  graduated: "var(--muted-foreground)",
  withdrawn: "var(--negative)",
};

type Row = {
  id: string;
  code: string;
  name: string;
  birth_year: number | null;
  gender: string | null;
  region: string | null;
  status: string;
  photo_url: string | null;
  enrolled_at: string | null;
};

export default async function BeneficiariesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status;

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("beneficiaries")
    .select("id, code, name, birth_year, gender, region, status, photo_url, enrolled_at")
    .eq("org_id", tenant.id)
    .order("code");
  if (filter && filter in STATUS_LABEL) q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="수혜자 관리"
        description="결연 수혜자(아동·노인 등). 최소 PII만 보유합니다."
      />

      <div className="flex gap-2 text-sm">
        <Link href="/admin/beneficiaries"
          className="rounded-md px-3 py-1.5 font-medium"
          style={{
            background: !filter ? "var(--accent)" : "var(--surface)",
            color: !filter ? "white" : "var(--muted-foreground)",
            border: "1px solid var(--border)", textDecoration: "none",
          }}>전체</Link>
        {Object.entries(STATUS_LABEL).map(([s, label]) => (
          <Link key={s} href={`/admin/beneficiaries?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>{label}</Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              수혜자가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["코드", "이름", "출생", "성별", "지역", "상태"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{b.code}</td>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/beneficiaries/${b.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>{b.name}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.birth_year ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.gender ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.region ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: STATUS_COLOR[b.status] }}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">수혜자 등록</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/beneficiaries"
              fields={[
                { name: "code", label: "결연 코드", required: true, placeholder: "KR-2026-0042" },
                { name: "name", label: "이름", required: true },
                { name: "birthYear", label: "출생연도", type: "number", min: 1900, max: 2030 },
                {
                  name: "gender", label: "성별", type: "select",
                  options: [
                    { value: "male", label: "남" }, { value: "female", label: "여" }, { value: "other", label: "기타" },
                  ],
                },
                { name: "region", label: "지역", placeholder: "서울 강북" },
                { name: "enrolledAt", label: "등록일", type: "date" },
                { name: "bio", label: "소개", type: "textarea", rows: 3 },
                { name: "photoUrl", label: "사진 URL" },
              ]}
              submitLabel="등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
