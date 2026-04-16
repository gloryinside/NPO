import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{
  action?: string;
  resource?: string;
}>;

type AuditLogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "member.create": "후원자 등록",
  "member.update": "후원자 수정",
  "member.delete": "후원자 삭제",
  "promise.create": "약정 등록",
  "promise.update": "약정 수정",
  "promise.suspend": "약정 일시중지",
  "promise.resume": "약정 재개",
  "promise.cancel": "약정 해지",
  "payment.mark_paid": "수기 납부완료",
  "payment.mark_unpaid": "미납 처리",
  "payment.retry_cms": "CMS 재출금",
  "payment.confirm_income": "수입 확정",
  "campaign.create": "캠페인 등록",
  "campaign.update": "캠페인 수정",
  "campaign.delete": "캠페인 삭제",
  "receipt.issue": "영수증 발급",
  "receipt.nts_export": "국세청 간소화 내보내기",
  "settings.update_toss": "Toss 설정 변경",
  "settings.update_erp": "ERP 설정 변경",
  "settings.update_org": "기관 정보 변경",
  "user.invite": "관리자 초대",
  "user.delete": "관리자 삭제",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ko-KR")} ${d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { action, resource } = await searchParams;

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .range(0, 199);

  if (action) query = query.eq("action", action);
  if (resource) query = query.eq("resource_type", resource);

  const { data } = await query;
  const logs = (data as unknown as AuditLogRow[]) ?? [];

  // 필터용 unique values
  const actionSet = new Set(logs.map((l) => l.action));
  const resourceSet = new Set(logs.map((l) => l.resource_type));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          감사 로그
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          관리자 주요 조작 이력 (최근 200건)
        </p>
      </div>

      {/* 필터 */}
      <form
        method="get"
        className="flex flex-wrap gap-3 items-end rounded-lg border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            액션
          </label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="rounded border px-3 py-1.5 text-sm"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <option value="">전체</option>
            {Array.from(actionSet)
              .sort()
              .map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a] ?? a}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            리소스
          </label>
          <select
            name="resource"
            defaultValue={resource ?? ""}
            className="rounded border px-3 py-1.5 text-sm"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <option value="">전체</option>
            {Array.from(resourceSet)
              .sort()
              .map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          적용
        </button>
        {(action || resource) && (
          <a
            href="/admin/audit-logs"
            className="text-xs underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            초기화
          </a>
        )}
      </form>

      {/* 로그 테이블 */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <th
                className="text-left px-4 py-3 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                시각
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                수행자
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                액션
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                대상
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                내용
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  조회된 감사 로그가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr
                  key={log.id}
                  style={{
                    borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <td
                    className="px-4 py-3 text-xs whitespace-nowrap"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDateTime(log.created_at)}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {log.actor_email ?? <span style={{ color: "var(--muted-foreground)" }}>system</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{
                        background: "rgba(124,58,237,0.1)",
                        color: "var(--accent)",
                      }}
                    >
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-xs font-mono"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {log.resource_type}
                    {log.resource_id && (
                      <span className="ml-1" style={{ opacity: 0.6 }}>
                        {log.resource_id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {log.summary ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
