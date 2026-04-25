import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "결연 상세" };

const LETTER_STATUS: Record<string, string> = {
  received: "접수",
  translating: "번역 중",
  reviewed: "검수 완료",
  delivered: "전달 완료",
  rejected: "반려",
};
const DIRECTION_LABEL: Record<string, string> = {
  to_beneficiary: "후원자 → 수혜자",
  to_sponsor: "수혜자 → 후원자",
};

export default async function SponsorshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [sRes, lettersRes] = await Promise.all([
    supabase.from("sponsorships")
      .select("*, members(name, email), beneficiaries(code, name, photo_url)")
      .eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("sponsor_letters")
      .select("id, direction, original_text, translated_text, status, created_at")
      .eq("org_id", tenant.id).eq("sponsorship_id", id).order("created_at", { ascending: false }),
  ]);

  const sponsorship = sRes.data;
  if (!sponsorship) return notFound();

  const member = (sponsorship as { members?: { name: string | null; email: string | null } | null }).members;
  const ben = (sponsorship as { beneficiaries?: { code: string | null; name: string | null; photo_url: string | null } | null }).beneficiaries;
  const letters = (lettersRes.data ?? []) as Array<{
    id: string; direction: string; original_text: string | null;
    translated_text: string | null; status: string; created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`결연 — ${member?.name ?? "?"} ↔ ${ben?.name ?? "?"}`}
        description={`${sponsorship.start_date} ~ ${sponsorship.end_date ?? "현재"} · ${sponsorship.status}`}
      />

      <section className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">결연 정보</h2>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-[var(--muted-foreground)]">후원자</dt>
          <dd className="col-span-2" style={{ color: "var(--text)" }}>{member?.name} {member?.email && `(${member.email})`}</dd>
          <dt className="text-[var(--muted-foreground)]">수혜자</dt>
          <dd className="col-span-2" style={{ color: "var(--text)" }}>{ben?.name} {ben?.code && `(${ben.code})`}</dd>
          <dt className="text-[var(--muted-foreground)]">월 약정</dt>
          <dd className="col-span-2" style={{ color: "var(--text)" }}>
            {sponsorship.monthly_amount != null
              ? `${Number(sponsorship.monthly_amount).toLocaleString("ko-KR")}원`
              : "미설정"}
          </dd>
          <dt className="text-[var(--muted-foreground)]">메모</dt>
          <dd className="col-span-2 whitespace-pre-wrap" style={{ color: "var(--text)" }}>{sponsorship.notes ?? "-"}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">편지 ({letters.length})</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {letters.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">편지 이력이 없습니다.</p>
            ) : (
              letters.map((l) => (
                <div key={l.id} className="rounded-2xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--muted-foreground)" }}>
                      {DIRECTION_LABEL[l.direction]} · {LETTER_STATUS[l.status]}
                    </span>
                    <span style={{ color: "var(--muted-foreground)" }}>
                      {new Date(l.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  {l.original_text && (
                    <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                      {l.original_text}
                    </p>
                  )}
                  {l.translated_text && (
                    <div className="mt-2 rounded-md p-2" style={{ background: "var(--surface-2)" }}>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)]">번역</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{l.translated_text}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">편지 등록</h3>
            <JsonForm
              url={`/api/admin/sponsorships/${id}/letters`}
              fields={[
                {
                  name: "direction", label: "방향", type: "select", required: true,
                  options: Object.entries(DIRECTION_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "originalText", label: "원본 텍스트", type: "textarea", rows: 5 },
              ]}
              submitLabel="편지 등록"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
