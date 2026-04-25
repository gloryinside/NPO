import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "물품기부 상세" };

export default async function InKindDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("in_kind_donations")
    .select("*, members(name, email, phone)")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (!row) return notFound();

  const member = (row as { members?: { name: string | null; email: string | null; phone: string | null } | null })
    .members;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`물품기부 — ${row.item_name}`}
        description={`상태: ${row.status}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">기본 정보</h2>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <dt className="text-[var(--muted-foreground)]">기부자</dt>
            <dd className="col-span-2 text-[var(--text)]">
              {member?.name ?? row.donor_name ?? "-"}
              {member?.email && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{member.email}</span>}
            </dd>
            <dt className="text-[var(--muted-foreground)]">물품</dt>
            <dd className="col-span-2 text-[var(--text)]">{row.item_name} × {row.quantity}</dd>
            <dt className="text-[var(--muted-foreground)]">카테고리</dt>
            <dd className="col-span-2 text-[var(--text)]">{row.category ?? "-"}</dd>
            <dt className="text-[var(--muted-foreground)]">추정가</dt>
            <dd className="col-span-2 text-[var(--text)]">
              {row.estimated_value != null ? `${Number(row.estimated_value).toLocaleString("ko-KR")}원` : "-"}
            </dd>
            <dt className="text-[var(--muted-foreground)]">평가가</dt>
            <dd className="col-span-2 font-semibold text-[var(--text)]">
              {row.appraised_value != null ? `${Number(row.appraised_value).toLocaleString("ko-KR")}원` : "미평가"}
            </dd>
            <dt className="text-[var(--muted-foreground)]">수령일</dt>
            <dd className="col-span-2 text-[var(--text)]">{row.received_at ?? "-"}</dd>
            <dt className="text-[var(--muted-foreground)]">설명</dt>
            <dd className="col-span-2 text-[var(--text)] whitespace-pre-wrap">{row.description ?? "-"}</dd>
          </dl>
        </section>

        <section className="space-y-4">
          {row.status === "pending" && (
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">평가 입력</h3>
              <JsonForm
                url={`/api/admin/in-kind/${row.id}`}
                method="PATCH"
                extra={{ status: "appraised" }}
                fields={[
                  { name: "appraisedValue", label: "공정시장가액(원)", type: "number", required: true, min: 0 },
                ]}
                submitLabel="평가 완료"
              />
            </div>
          )}

          {(row.status === "pending" || row.status === "appraised") && (
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">상태 전환</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <form action={`/api/admin/in-kind/${row.id}`} method="post">
                  <JsonForm
                    url={`/api/admin/in-kind/${row.id}`}
                    method="PATCH"
                    extra={{ status: "accepted" }}
                    fields={[]}
                    submitLabel="수락"
                  />
                </form>
                <JsonForm
                  url={`/api/admin/in-kind/${row.id}`}
                  method="PATCH"
                  extra={{ status: "rejected" }}
                  fields={[
                    { name: "rejectedReason", label: "반려 사유", required: true, type: "textarea", rows: 2 },
                  ]}
                  submitLabel="반려"
                />
              </div>
            </div>
          )}

          {row.rejected_reason && (
            <div className="rounded-2xl border p-4 text-sm"
              style={{ borderColor: "var(--negative)", background: "var(--negative-soft)", color: "var(--negative)" }}>
              <b>반려 사유:</b> {row.rejected_reason}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
