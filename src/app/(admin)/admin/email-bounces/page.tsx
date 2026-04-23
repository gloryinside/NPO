import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "이메일 반송" };

const TYPE_LABEL: Record<string, string> = {
  hard: "Hard (영구 실패)",
  soft: "Soft (일시 실패)",
  complaint: "스팸 신고",
  delivery_delay: "지연",
};
const TYPE_COLOR: Record<string, string> = {
  hard: "var(--negative)",
  soft: "var(--warning)",
  complaint: "var(--negative)",
  delivery_delay: "var(--muted-foreground)",
};

type Row = {
  id: string;
  recipient_email: string;
  bounce_type: string;
  reason: string | null;
  provider: string;
  created_at: string;
};

export default async function AdminEmailBouncesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("email_bounces")
    .select("id, recipient_email, bounce_type, reason, provider, created_at")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data as unknown as Row[]) ?? [];

  // 최근 30일 통계
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = rows.filter((r) => new Date(r.created_at) >= cutoff);
  const byType = new Map<string, number>();
  for (const r of recent) {
    byType.set(r.bounce_type, (byType.get(r.bounce_type) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">이메일 반송</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Resend 에서 수신된 bounce/complaint 이벤트. hard/complaint 는 자동으로 이메일 수신이 중단됩니다.
        </p>
      </div>

      {/* 30일 요약 */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(["hard", "soft", "complaint", "delivery_delay"] as const).map(
          (t) => (
            <div
              key={t}
              className="rounded-2xl border p-5"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <p className="text-xs text-[var(--muted-foreground)]">
                {TYPE_LABEL[t]}
              </p>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: TYPE_COLOR[t] }}
              >
                {byType.get(t) ?? 0}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                최근 30일
              </p>
            </div>
          )
        )}
      </section>

      {/* 목록 */}
      {rows.length === 0 ? (
        <div
          className="rounded-2xl border py-12 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
          }}
        >
          반송 이력이 없습니다.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <table className="w-full">
            <thead
              style={{
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <tr>
                {["일시", "이메일", "유형", "제공자", "사유"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {new Date(r.created_at).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </td>
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--text)" }}
                  >
                    {r.recipient_email}
                  </td>
                  <td
                    className="px-4 py-3 text-xs font-semibold"
                    style={{ color: TYPE_COLOR[r.bounce_type] }}
                  >
                    {TYPE_LABEL[r.bounce_type] ?? r.bounce_type}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.provider}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.reason ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
