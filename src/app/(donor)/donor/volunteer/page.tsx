import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "봉사 활동 이력" };

type Row = {
  id: string;
  activity_date: string;
  activity_name: string;
  location: string | null;
  hours: number;
  external_certified: boolean;
  external_cert_no: string | null;
};

export default async function DonorVolunteerPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("volunteer_activities")
    .select("id, activity_date, activity_name, location, hours, external_certified, external_cert_no")
    .eq("org_id", session.member.org_id)
    .eq("volunteer_id", session.member.id)
    .order("activity_date", { ascending: false });

  const rows = (data as Row[]) ?? [];
  const totalHours = rows.reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
  const certifiedHours = rows
    .filter((r) => r.external_certified)
    .reduce((acc, r) => acc + Number(r.hours ?? 0), 0);

  // 연도별 합계
  const byYear = new Map<string, number>();
  for (const r of rows) {
    const y = r.activity_date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + Number(r.hours ?? 0));
  }
  const yearlyData = Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text)]">봉사 활동 이력</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          기관에 기여하신 봉사 시간이 기록되어 있습니다.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs text-[var(--muted-foreground)]">총 활동시간</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{totalHours.toLocaleString("ko-KR")}h</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs text-[var(--muted-foreground)]">활동 건수</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{rows.length}건</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs text-[var(--muted-foreground)]">1365 인증</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{certifiedHours}h</p>
        </div>
      </div>

      {yearlyData.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">연도별</h2>
          <ul className="space-y-2">
            {yearlyData.map(([year, hours]) => (
              <li key={year} className="flex items-center justify-between rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <span style={{ color: "var(--text)" }}>{year}년</span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{hours}시간</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">활동 내역</h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border py-10 text-center text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
            활동 이력이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border px-4 py-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: "var(--text)" }}>{r.activity_name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {r.activity_date}
                      {r.location && ` · ${r.location}`}
                      {r.external_certified && r.external_cert_no && ` · 1365 ${r.external_cert_no}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{r.hours}h</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
