import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "자원봉사 활동" };

type Row = {
  id: string;
  activity_date: string;
  activity_name: string;
  location: string | null;
  hours: number;
  external_certified: boolean;
  external_cert_no: string | null;
  members: { name: string | null } | null;
};

export default async function VolunteerActivitiesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("volunteer_activities")
    .select("id, activity_date, activity_name, location, hours, external_certified, external_cert_no, members(name)")
    .eq("org_id", tenant.id)
    .order("activity_date", { ascending: false })
    .limit(300);

  const rows = (data as unknown as Row[]) ?? [];
  const totalHours = rows.reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
  const certifiedCount = rows.filter((r) => r.external_certified).length;

  // 봉사자(member_type=volunteer) 목록
  const { data: vols } = await supabase
    .from("members")
    .select("id, name")
    .eq("org_id", tenant.id)
    .eq("member_type", "volunteer")
    .order("name")
    .limit(500);

  return (
    <div className="space-y-6">
      <PageHeader
        title="자원봉사 활동"
        description="봉사자 활동시간/장소/배치 기록. 1365 등 외부 인증 추적."
        stats={
          <>
            <StatCard label="활동 건수" value={`${rows.length.toLocaleString("ko-KR")}건`} />
            <StatCard label="총 활동시간" value={`${totalHours.toLocaleString("ko-KR")}시간`} />
            <StatCard label="외부 인증" value={`${certifiedCount}건`} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              활동 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["일자", "봉사자", "활동", "장소", "시간", "인증"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.activity_date}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.members?.name ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.activity_name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.location ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{r.hours}h</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: r.external_certified ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {r.external_certified ? `✓ ${r.external_cert_no ?? ""}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">활동 등록</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/volunteer-activities"
              fields={[
                {
                  name: "volunteerId", label: "봉사자", type: "select", required: true,
                  options: ((vols as Array<{ id: string; name: string }>) ?? []).map((v) => ({ value: v.id, label: v.name })),
                },
                { name: "activityDate", label: "활동일", type: "date", required: true },
                { name: "activityName", label: "활동명", required: true, placeholder: "급식 배식 봉사" },
                { name: "location", label: "장소" },
                { name: "hours", label: "시간(0~24)", type: "number", required: true, step: "0.5", min: 0.5, max: 24 },
                { name: "externalCertNo", label: "1365 인증번호" },
                { name: "externalCertified", label: "외부 인증 완료", type: "checkbox" },
                { name: "notes", label: "메모", type: "textarea", rows: 2 },
              ]}
              submitLabel="기록 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
