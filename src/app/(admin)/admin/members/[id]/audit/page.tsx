import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "회원 활동 이력" };

type RouteContext = { params: Promise<{ id: string }> };

type AuditRow = {
  id: string;
  action: string;
  diff: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  profile_update: "프로필 변경",
  password_change: "비밀번호 변경",
  account_delete: "계정 삭제",
  email_change_attempt: "이메일 변경 시도",
  "2fa_enroll": "2FA 등록",
  "2fa_unenroll": "2FA 해제",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

/**
 * G-D82: 회원별 활동 이력 열람 (admin).
 *   - member_audit_log 에 기록된 본인 계정 변경 이벤트 시계열 표시
 *   - diff 는 접어서 표시 (민감 정보는 기록 시점에 이미 마스킹)
 */
export default async function AdminMemberAuditPage({
  params,
}: RouteContext) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, name, member_code, email")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (!member) notFound();

  const { data } = await supabase
    .from("member_audit_log")
    .select("id, action, diff, ip, user_agent, created_at")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as AuditRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {member.name}님 활동 이력
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {member.member_code} · 본인이 수행한 계정 변경 최근 200건
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
          }}
        >
          기록된 활동 이력이 없습니다.
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
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  시각
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  이벤트
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  변경 내용
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(r.created_at)}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {ACTION_LABEL[r.action] ?? r.action}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.diff && Object.keys(r.diff).length > 0 ? (
                      <details>
                        <summary
                          className="cursor-pointer"
                          style={{ color: "var(--accent)" }}
                        >
                          펼치기
                        </summary>
                        <pre
                          className="mt-2 overflow-x-auto rounded-md p-2 text-[11px]"
                          style={{
                            background: "var(--surface-2)",
                            color: "var(--text)",
                          }}
                        >
                          {JSON.stringify(r.diff, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span style={{ color: "var(--muted-foreground)" }}>
                        -
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.ip ?? "-"}
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
