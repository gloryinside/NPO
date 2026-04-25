import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "수혜자 상세" };

export default async function BeneficiaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [beneRes, sponsorshipsRes, updatesRes] = await Promise.all([
    supabase.from("beneficiaries").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("sponsorships")
      .select("id, sponsor_member_id, start_date, end_date, status, monthly_amount, members(name)")
      .eq("org_id", tenant.id).eq("beneficiary_id", id).order("start_date", { ascending: false }),
    supabase.from("beneficiary_updates")
      .select("id, update_date, title, body, photo_urls, visibility")
      .eq("org_id", tenant.id).eq("beneficiary_id", id).order("update_date", { ascending: false }),
  ]);

  const ben = beneRes.data;
  if (!ben) return notFound();

  const sponsorships = (sponsorshipsRes.data ?? []) as unknown as Array<{
    id: string; sponsor_member_id: string; start_date: string; end_date: string | null;
    status: string; monthly_amount: number | null; members: { name: string | null } | null;
  }>;
  const updates = (updatesRes.data ?? []) as Array<{
    id: string; update_date: string; title: string | null; body: string | null;
    photo_urls: unknown; visibility: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ben.name} (${ben.code})`}
        description={`${ben.region ?? "지역 미상"} · ${ben.birth_year ? `${ben.birth_year}년생` : ""} · ${ben.status}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">소개</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ben.photo_url && <img src={ben.photo_url} alt="" className="mb-3 max-h-64 rounded-md" />}
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>
            {ben.bio ?? "소개가 없습니다."}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">결연 후원자</h2>
          {sponsorships.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">아직 결연된 후원자가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {sponsorships.map((s) => (
                <li key={s.id} className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <Link href={`/admin/sponsorships/${s.id}`}
                    style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {s.members?.name ?? s.sponsor_member_id}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                    {s.start_date} ~ {s.end_date ?? "현재"} · {s.status}
                    {s.monthly_amount != null && ` · 월 ${Number(s.monthly_amount).toLocaleString("ko-KR")}원`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">정기 근황 ({updates.length})</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            {updates.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">근황 업데이트가 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {updates.map((u) => (
                  <li key={u.id} className="rounded-2xl border p-4"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--text)]">{u.title ?? "(제목 없음)"}</p>
                      <span className="text-xs text-[var(--muted-foreground)]">{u.update_date}</span>
                    </div>
                    {u.body && (
                      <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{u.body}</p>
                    )}
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      공개: {u.visibility === "public" ? "전체 공개" : "후원자 한정"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">근황 추가</h3>
            <JsonForm
              url={`/api/admin/beneficiaries/${id}/updates`}
              fields={[
                { name: "updateDate", label: "날짜", type: "date" },
                { name: "title", label: "제목" },
                { name: "body", label: "내용", type: "textarea", rows: 4 },
                {
                  name: "visibility", label: "공개 범위", type: "select",
                  defaultValue: "sponsors_only",
                  options: [
                    { value: "sponsors_only", label: "결연 후원자만" },
                    { value: "public", label: "전체 공개" },
                  ],
                },
              ]}
              submitLabel="등록"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
