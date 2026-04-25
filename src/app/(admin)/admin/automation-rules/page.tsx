import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonPostButton } from "@/components/admin/json-post-button";

export const metadata = { title: "자동화 룰" };

const TRIGGER_LABEL: Record<string, string> = {
  payment_paid: "결제 완료",
  payment_failed: "결제 실패",
  promise_created: "약정 생성",
  promise_cancelled: "약정 해지",
  member_inactive_days: "회원 비활성 N일",
  cumulative_milestone: "누적 마일스톤 달성",
  birthday: "생일",
};

type Row = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  conditions: unknown;
  actions: unknown;
  active: boolean;
  cooldown_minutes: number;
  last_run_at: string | null;
  run_count: number;
};

export default async function AutomationRulesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("automation_rules")
    .select("id, name, description, trigger_type, conditions, actions, active, cooldown_minutes, last_run_at, run_count")
    .eq("org_id", tenant.id)
    .order("name");

  const rows = (data as Row[]) ?? [];

  // 최근 실행 통계
  const { data: recent } = await supabase
    .from("automation_rule_runs")
    .select("status")
    .eq("org_id", tenant.id)
    .gte("ran_at", new Date(Date.now() - 7 * 86400_000).toISOString());

  const stats = { success: 0, partial: 0, failed: 0, skipped: 0 };
  for (const r of (recent ?? []) as Array<{ status: string }>) {
    if (r.status in stats) (stats as Record<string, number>)[r.status]++;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="자동화 룰"
        description="이벤트(결제완료/실패 등) 발생 시 조건에 따라 이메일/태그/회원필드 자동 액션을 실행합니다."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["success", "partial", "skipped", "failed"] as const).map((s) => (
          <div key={s} className="rounded-2xl border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs text-[var(--muted-foreground)]">최근 7일 {s}</p>
            <p className="mt-1 text-xl font-bold"
              style={{ color: s === "failed" ? "var(--negative)" : s === "skipped" ? "var(--muted-foreground)" : "var(--text)" }}>
              {stats[s]}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          등록된 룰이 없습니다.
          <p className="mt-3 text-xs">
            룰은 JSON 구조로 정의됩니다 (트리거/조건/액션). API <code>/api/admin/automation-rules</code> 로 직접 POST하거나, 추후 UI 빌더를 사용하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {r.name}
                    <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                      {TRIGGER_LABEL[r.trigger_type] ?? r.trigger_type}
                    </span>
                  </p>
                  {r.description && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{r.description}</p>
                  )}
                  <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <div className="rounded-md p-2 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                      <p className="font-semibold">조건 ({Array.isArray(r.conditions) ? r.conditions.length : 0}개)</p>
                      <pre className="mt-1 overflow-auto" style={{ maxHeight: 120 }}>
                        {JSON.stringify(r.conditions, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-md p-2 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                      <p className="font-semibold">액션 ({Array.isArray(r.actions) ? r.actions.length : 0}개)</p>
                      <pre className="mt-1 overflow-auto" style={{ maxHeight: 120 }}>
                        {JSON.stringify(r.actions, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    cooldown {r.cooldown_minutes}분 · 실행 {r.run_count}회
                    {r.last_run_at && ` · 최근 ${new Date(r.last_run_at).toLocaleString("ko-KR")}`}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <JsonPostButton
                    url={`/api/admin/automation-rules/${r.id}`}
                    method="PATCH"
                    body={{ active: !r.active }}
                    label={r.active ? "비활성화" : "활성화"}
                    variant={r.active ? "default" : "primary"}
                  />
                  <JsonPostButton
                    url={`/api/admin/automation-rules/${r.id}`}
                    method="DELETE"
                    label="삭제"
                    variant="danger"
                    confirm="이 룰을 삭제할까요?"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
