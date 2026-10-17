import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "행사/이벤트" };

const TYPE_LABEL: Record<string, string> = {
  meetup: "모임",
  gala: "갈라",
  volunteer: "봉사",
  workshop: "워크숍",
  briefing: "설명회",
  other: "기타",
};
const STATUS_LABEL: Record<string, string> = {
  planning: "계획",
  open: "신청 접수",
  closed: "마감",
  completed: "완료",
  cancelled: "취소",
};

type Row = {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  capacity: number | null;
  status: string;
};

export default async function EventsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("events")
    .select("id, title, event_type, start_at, end_at, location, capacity, status")
    .eq("org_id", tenant.id)
    .order("start_at", { ascending: false })
    .limit(100);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="행사"
        description="후원자의 밤·정기 모임·봉사 행사·갈라 등 행사 관리."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 행사가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["제목", "유형", "일시", "장소", "정원", "상태"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/events/${e.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {e.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[e.event_type] ?? e.event_type}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(e.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{e.location ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{e.capacity ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[e.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 행사</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/events"
              fields={[
                { name: "title", label: "제목", required: true },
                {
                  name: "eventType", label: "유형", type: "select",
                  defaultValue: "meetup",
                  options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "startAt", label: "시작", type: "datetime-local", required: true },
                { name: "endAt", label: "종료", type: "datetime-local" },
                { name: "location", label: "장소" },
                { name: "capacity", label: "정원", type: "number", min: 1 },
                { name: "registrationDeadline", label: "신청 마감", type: "datetime-local" },
                {
                  name: "status", label: "상태", type: "select",
                  defaultValue: "planning",
                  options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "description", label: "설명", type: "textarea" },
              ]}
              submitLabel="행사 등록"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
