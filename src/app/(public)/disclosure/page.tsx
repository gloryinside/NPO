import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "정보공시" };

const TYPE_LABEL: Record<string, string> = {
  income_summary: "수입명세",
  expense_summary: "사용명세",
  salary_top5: "임직원 보수 상위 5인",
  related_party: "특수관계인 거래",
  fundraising_cost: "모금 비용",
  donor_top5: "1억 이상 기부자",
  other: "기타",
};

export default async function PublicDisclosurePage() {
  let tenantId: string | null = null;
  let orgName = "단체";
  try {
    const t = await requireTenant();
    tenantId = t.id;
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("orgs").select("name").eq("id", t.id).maybeSingle();
    if (data?.name) orgName = data.name;
  } catch {
    return <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">단체 정보를 불러올 수 없습니다.</div>;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("transparency_disclosures")
    .select("id, fiscal_year, disclosure_type, title, pdf_url, published_at")
    .eq("org_id", tenantId)
    .eq("status", "published")
    .order("fiscal_year", { ascending: false });

  type Row = { id: string; fiscal_year: number; disclosure_type: string; title: string; pdf_url: string | null; published_at: string };
  const rows = (data ?? []) as Row[];

  // 연도별 그룹
  const byYear = new Map<number, Row[]>();
  for (const r of rows) {
    const arr = byYear.get(r.fiscal_year) ?? [];
    arr.push(r);
    byYear.set(r.fiscal_year, arr);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">{orgName} 정보공시</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          공익법인 의무 공시 항목입니다. 모든 공시 자료는 누구나 열람하실 수 있습니다.
        </p>
      </header>

      {years.length === 0 ? (
        <p className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          공시된 자료가 없습니다.
        </p>
      ) : (
        <div className="space-y-8">
          {years.map((y) => (
            <section key={y}>
              <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">{y}년도</h2>
              <ul className="space-y-2">
                {byYear.get(y)!.map((r) => (
                  <li key={r.id} className="rounded-md border p-4"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">
                          {TYPE_LABEL[r.disclosure_type] ?? r.disclosure_type} — {r.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          공시일 {new Date(r.published_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      {r.pdf_url && (
                        <a href={r.pdf_url} target="_blank" rel="noreferrer"
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                          style={{ background: "var(--accent)", textDecoration: "none" }}>
                          PDF 다운로드
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
