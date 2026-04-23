import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "후원자 라이프사이클" };

const STAGE_LABEL: Record<string, string> = {
  new: "신규 (≤30일)",
  active: "활성 (90일 내 결제)",
  dormant: "휴면 (3-12개월 미결제)",
  churned: "이탈 (12개월+ 미결제)",
  vip: "VIP (수동 지정)",
  unclassified: "미분류",
};

const STAGE_COLOR: Record<string, string> = {
  new: "var(--info)",
  active: "var(--positive)",
  dormant: "var(--warning)",
  churned: "var(--negative)",
  vip: "var(--accent)",
  unclassified: "var(--muted-foreground)",
};

export default async function AdminLifecyclePage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("members")
    .select("id, lifecycle_stage")
    .eq("org_id", tenant.id)
    .is("deleted_at", null);

  const rows = (data ?? []) as Array<{
    id: string;
    lifecycle_stage: string | null;
  }>;

  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.lifecycle_stage ?? "unclassified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length || 1;
  const order = ["new", "active", "dormant", "churned", "vip", "unclassified"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          후원자 라이프사이클
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          cron <code>classify-lifecycle</code>이 매일 자동 분류합니다. 수동으로 지정된
          VIP 는 자동 재분류 대상에서 제외됩니다.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {order.map((k) => {
          const c = counts.get(k) ?? 0;
          return (
            <div
              key={k}
              className="rounded-2xl border p-5"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                {STAGE_LABEL[k]}
              </p>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: STAGE_COLOR[k] }}
              >
                {c.toLocaleString()}명
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {((c / total) * 100).toFixed(1)}%
              </p>
            </div>
          );
        })}
      </section>

      <section
        className="rounded-2xl border p-5 text-sm"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
          color: "var(--muted-foreground)",
        }}
      >
        <p className="font-semibold text-[var(--text)]">추천 작업</p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• dormant · churned 에게는 <b>재활성화 제안 cron</b>이 자동 이메일을 보냅니다.</li>
          <li>• new 비율이 급증 시 CAC 와 함께 점검 (<code>/admin/stats/ltv</code>).</li>
          <li>• VIP 후보는 누적 후원액 100만원 이상에서 수동 지정하세요.</li>
        </ul>
      </section>
    </div>
  );
}
