import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SponsorLetters } from "@/components/donor/sponsor-letters";

export const metadata = { title: "내 결연" };

type Sponsorship = {
  id: string;
  beneficiary_id: string;
  start_date: string;
  end_date: string | null;
  monthly_amount: number | null;
  status: string;
  beneficiaries: {
    id: string; code: string | null; name: string | null;
    birth_year: number | null; region: string | null;
    photo_url: string | null; bio: string | null;
  } | null;
};

type Update = {
  id: string;
  beneficiary_id: string;
  update_date: string;
  title: string | null;
  body: string | null;
};

export default async function DonorSponsorshipsPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const supabase = createSupabaseAdminClient();
  const { data: sponsorships } = await supabase
    .from("sponsorships")
    .select(
      "id, beneficiary_id, start_date, end_date, monthly_amount, status, beneficiaries(id, code, name, birth_year, region, photo_url, bio)"
    )
    .eq("org_id", session.member.org_id)
    .eq("sponsor_member_id", session.member.id)
    .order("start_date", { ascending: false });

  const items = ((sponsorships ?? []) as unknown as Sponsorship[]);
  const benIds = items.map((s) => s.beneficiary_id);

  let updatesByBen = new Map<string, Update[]>();
  if (benIds.length > 0) {
    const { data: updates } = await supabase
      .from("beneficiary_updates")
      .select("id, beneficiary_id, update_date, title, body")
      .eq("org_id", session.member.org_id)
      .in("beneficiary_id", benIds)
      .order("update_date", { ascending: false })
      .limit(20);
    updatesByBen = new Map();
    for (const u of (updates ?? []) as Update[]) {
      const arr = updatesByBen.get(u.beneficiary_id) ?? [];
      arr.push(u);
      updatesByBen.set(u.beneficiary_id, arr);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text)]">내 결연</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          후원으로 함께하고 있는 수혜자의 정보와 근황을 확인할 수 있습니다.
        </p>
      </header>

      {items.length === 0 ? (
        <div
          className="rounded-2xl border py-12 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}
        >
          아직 결연된 수혜자가 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((s) => {
            const ben = s.beneficiaries;
            const updates = updatesByBen.get(s.beneficiary_id) ?? [];
            return (
              <section key={s.id} className="rounded-2xl border p-5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {ben?.photo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={ben.photo_url} alt="" className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-[var(--text)]">{ben?.name ?? "(이름 없음)"}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {ben?.code && `${ben.code} · `}
                      {ben?.birth_year && `${ben.birth_year}년생 · `}
                      {ben?.region ?? "-"}
                    </p>
                    {ben?.bio && (
                      <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{ben.bio}</p>
                    )}
                    <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                      결연 시작 {s.start_date}
                      {s.monthly_amount != null && ` · 월 ${Number(s.monthly_amount).toLocaleString("ko-KR")}원`}
                      {" · "}
                      <span style={{ color: s.status === "active" ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {s.status === "active" ? "진행중" : s.status === "paused" ? "일시정지" : "종료"}
                      </span>
                    </p>
                  </div>
                </div>

                {updates.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-[var(--text)]">정기 근황</p>
                    <ul className="mt-2 space-y-2">
                      {updates.map((u) => (
                        <li key={u.id} className="rounded-md border p-3 text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium" style={{ color: "var(--text)" }}>{u.title ?? "(근황)"}</span>
                            <span className="text-xs text-[var(--muted-foreground)]">{u.update_date}</span>
                          </div>
                          {u.body && (
                            <p className="mt-1 whitespace-pre-wrap" style={{ color: "var(--text)" }}>{u.body}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <SponsorLetters sponsorshipId={s.id} canWrite={s.status === "active"} childName={ben?.name ?? "아이"} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
