import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "DM 우편 캠페인" };

const STATUS_LABEL: Record<string, string> = {
  planning: "계획",
  exported: "명단 추출 완료",
  sent: "발송 완료",
  cancelled: "취소",
};

type Row = {
  id: string;
  name: string;
  status: string;
  recipient_count: number;
  exported_at: string | null;
  sent_at: string | null;
  delivered_count: number | null;
  returned_count: number | null;
  created_at: string;
};

export default async function MailCampaignsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("mail_campaigns")
    .select("id, name, status, recipient_count, exported_at, sent_at, delivered_count, returned_count, created_at")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="DM 우편 캠페인"
        description="세그먼트 기반 우편 발송 명단 추출 → CSV 다운로드 → 발송 결과 입력."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 캠페인이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["캠페인명", "상태", "수신자 수", "발송일", "도착/반송", "생성일"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/mail-campaigns/${c.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[c.status]}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{c.recipient_count.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.sent_at ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {c.delivered_count != null ? `${c.delivered_count}/${c.returned_count ?? 0}` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(c.created_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 캠페인 생성</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/mail-campaigns"
              fields={[
                { name: "name", label: "캠페인명", required: true, placeholder: "2026 봄 뉴스레터" },
                { name: "description", label: "설명", type: "textarea", rows: 2 },
              ]}
              submitLabel="생성"
              successMessage="생성됨 — 상세에서 세그먼트 설정"
            />
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              세그먼트 필터(등급/태그/누적후원금)는 캠페인 상세에서 설정합니다.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
