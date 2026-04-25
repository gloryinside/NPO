import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "회원 태그" };

type Tag = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
};

export default async function MemberTagsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: tags } = await supabase
    .from("member_tags")
    .select("id, name, color, description, created_at")
    .eq("org_id", tenant.id)
    .order("name");

  // 각 태그별 부여 회원 수
  const ids = ((tags as Tag[]) ?? []).map((t) => t.id);
  let countMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: assigns } = await supabase
      .from("member_tag_assignments")
      .select("tag_id")
      .eq("org_id", tenant.id)
      .in("tag_id", ids);
    countMap = new Map();
    for (const a of (assigns ?? []) as Array<{ tag_id: string }>) {
      countMap.set(a.tag_id, (countMap.get(a.tag_id) ?? 0) + 1);
    }
  }

  const rows = ((tags as Tag[]) ?? []).map((t) => ({
    ...t,
    member_count: countMap.get(t.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="회원 태그"
        description="회원에게 부여할 자유 태그(VIP, 임원, 만난적 있음 등)를 정의합니다."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
            등록된 태그 ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              아직 등록된 태그가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["태그", "설명", "부여 회원", "생성일"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--muted-foreground)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: t.color ?? "#6366f1" }}>
                          {t.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {t.description ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text)" }}>
                        {t.member_count.toLocaleString("ko-KR")}명
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(t.created_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 태그 추가</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/member-tags"
              fields={[
                { name: "name", label: "태그명", required: true, placeholder: "예: VIP" },
                { name: "color", label: "색상 (HEX)", placeholder: "#6366f1" },
                { name: "description", label: "설명", type: "textarea", rows: 2 },
              ]}
              submitLabel="태그 생성"
              successMessage="추가됨"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
