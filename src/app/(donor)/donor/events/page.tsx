import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EventRegisterButton } from "./event-register-button";

export const metadata = { title: "행사" };

const TYPE_LABEL: Record<string, string> = {
  meetup: "모임", gala: "갈라", volunteer: "봉사",
  workshop: "워크숍", briefing: "설명회", other: "기타",
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  capacity: number | null;
  registration_deadline: string | null;
  status: string;
};

export default async function DonorEventsPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const supabase = createSupabaseAdminClient();
  // open 또는 진행중/완료된 행사만 노출
  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, event_type, start_at, end_at, location, capacity, registration_deadline, status")
    .eq("org_id", session.member.org_id)
    .in("status", ["open", "closed", "completed"])
    .order("start_at", { ascending: false })
    .limit(60);

  const list = (events as Event[]) ?? [];

  // 본인 신청 이력 조회
  const eventIds = list.map((e) => e.id);
  let myRegSet = new Set<string>();
  if (eventIds.length > 0) {
    const { data: atts } = await supabase
      .from("event_attendances")
      .select("event_id, status")
      .eq("org_id", session.member.org_id)
      .eq("member_id", session.member.id)
      .in("event_id", eventIds)
      .in("status", ["registered", "checked_in"]);
    myRegSet = new Set((atts ?? []).map((a: { event_id: string }) => a.event_id));
  }

  const upcoming = list.filter((e) => new Date(e.start_at) >= new Date());
  const past = list.filter((e) => new Date(e.start_at) < new Date());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text)]">행사</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          기관에서 진행하는 행사에 참여하실 수 있습니다.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">예정된 행사</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border py-8 text-center text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
            예정된 행사가 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => {
              const registered = myRegSet.has(e.id);
              const canRegister = e.status === "open" && !registered &&
                (!e.registration_deadline || new Date(e.registration_deadline) > new Date());
              return (
                <li key={e.id} className="rounded-2xl border p-5"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[var(--text)]">{e.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {TYPE_LABEL[e.event_type] ?? e.event_type} ·{" "}
                        {new Date(e.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                        {e.location && ` · ${e.location}`}
                      </p>
                      {e.description && (
                        <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                          {e.description}
                        </p>
                      )}
                      {e.capacity != null && (
                        <p className="mt-2 text-xs text-[var(--muted-foreground)]">정원 {e.capacity}명</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {registered ? (
                        <span className="rounded-md px-3 py-1.5 text-xs font-medium"
                          style={{ background: "var(--positive-soft)", color: "var(--positive)" }}>
                          신청 완료
                        </span>
                      ) : canRegister ? (
                        <EventRegisterButton eventId={e.id} />
                      ) : (
                        <span className="rounded-md px-3 py-1.5 text-xs font-medium"
                          style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                          {e.status === "open" ? "마감" : "신청 종료"}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">지난 행사</h2>
          <ul className="space-y-2">
            {past.map((e) => (
              <li key={e.id} className="rounded-md border px-4 py-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="font-medium" style={{ color: "var(--text)" }}>{e.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {new Date(e.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                  {e.location && ` · ${e.location}`}
                  {myRegSet.has(e.id) && " · 참여하셨습니다"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
