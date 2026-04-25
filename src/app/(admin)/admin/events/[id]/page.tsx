import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { JsonForm } from "@/components/admin/json-form";
import { JsonPostButton } from "@/components/admin/json-post-button";

export const metadata = { title: "행사 상세" };

const STATUS_LABEL: Record<string, string> = {
  registered: "등록",
  checked_in: "체크인",
  no_show: "노쇼",
  cancelled: "취소",
};
const STATUS_COLOR: Record<string, string> = {
  registered: "var(--info)",
  checked_in: "var(--positive)",
  no_show: "var(--warning)",
  cancelled: "var(--muted-foreground)",
};

type Att = {
  id: string;
  member_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  party_size: number;
  status: string;
  registered_at: string;
  checked_in_at: string | null;
  members: { name: string | null; phone: string | null; email: string | null } | null;
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [eventRes, attRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("event_attendances")
      .select("id, member_id, guest_name, guest_email, guest_phone, party_size, status, registered_at, checked_in_at, members(name, phone, email)")
      .eq("org_id", tenant.id).eq("event_id", id).order("registered_at", { ascending: false }),
  ]);

  const event = eventRes.data;
  if (!event) return notFound();

  const atts = (attRes.data as unknown as Att[]) ?? [];
  const stats = { registered: 0, checked_in: 0, no_show: 0, cancelled: 0, totalParty: 0 };
  for (const a of atts) {
    if (a.status in stats) (stats as Record<string, number>)[a.status]++;
    stats.totalParty += a.party_size;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={`${new Date(event.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · ${event.location ?? "장소 미정"}`}
        stats={
          <>
            <StatCard label="등록" value={`${stats.registered}건`} />
            <StatCard label="체크인" value={`${stats.checked_in}건`} />
            <StatCard label="노쇼" value={`${stats.no_show}건`} tone={stats.no_show > 0 ? "warning" : "default"} />
            <StatCard label="총 인원" value={`${stats.totalParty}명`} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">참석자 명단</h2>
          {atts.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">참석자가 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["이름", "연락처", "인원", "상태", "액션"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {atts.map((a) => {
                    const name = a.members?.name ?? a.guest_name ?? "-";
                    const phone = a.members?.phone ?? a.guest_phone ?? "-";
                    return (
                      <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{name}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{phone}</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{a.party_size}명</td>
                        <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: STATUS_COLOR[a.status] }}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </td>
                        <td className="px-3 py-2.5">
                          {a.status === "registered" && (
                            <span className="flex flex-wrap gap-1">
                              <JsonPostButton
                                url={`/api/admin/events/${id}/attendances/${a.id}`}
                                method="PATCH"
                                body={{ status: "checked_in" }}
                                label="체크인"
                                variant="primary"
                              />
                              <JsonPostButton
                                url={`/api/admin/events/${id}/attendances/${a.id}`}
                                method="PATCH"
                                body={{ status: "no_show" }}
                                label="노쇼"
                              />
                              <JsonPostButton
                                url={`/api/admin/events/${id}/attendances/${a.id}`}
                                method="PATCH"
                                body={{ status: "cancelled" }}
                                label="취소"
                              />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">참석자 등록</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url={`/api/admin/events/${id}/attendances`}
              fields={[
                { name: "memberId", label: "회원 ID (있으면)", helpText: "비회원 게스트면 비워두고 아래 정보 입력" },
                { name: "guestName", label: "게스트 이름" },
                { name: "guestPhone", label: "게스트 연락처" },
                { name: "guestEmail", label: "게스트 이메일" },
                { name: "partySize", label: "동반 인원 (본인 포함)", type: "number", min: 1, defaultValue: 1 },
                { name: "notes", label: "메모", type: "textarea", rows: 2 },
              ]}
              submitLabel="등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
