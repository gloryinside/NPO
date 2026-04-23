import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { detectDuplicateMembers } from "@/lib/members/duplicate-detection";

export const metadata = { title: "중복 회원 후보" };

const MATCH_LABEL = {
  email: "이메일 동일",
  phone: "전화번호 동일",
  name_birth: "이름+생년월일 동일",
} as const;

export default async function AdminMemberDuplicatesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const groups = await detectDuplicateMembers(supabase, tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">중복 회원 후보</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          같은 이메일, 전화번호 또는 이름+생년월일을 공유하는 회원 그룹입니다.
          실제 중복 여부는 내역 확인 후 관리자가 수동 조정합니다.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-2xl border py-16 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
          }}
        >
          🎉 중복 후보가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={`${g.matchType}:${g.key}`}
              className="overflow-hidden rounded-2xl border"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--warning)" }}
                  >
                    {MATCH_LABEL[g.matchType]}
                  </p>
                  <p
                    className="mt-0.5 font-mono text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {g.key}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: "var(--warning-soft)",
                    color: "var(--warning)",
                  }}
                >
                  {g.members.length}건
                </span>
              </div>
              <ul>
                {g.members.map((m, idx) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                    style={{
                      borderTop:
                        idx === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {m.name ?? "(이름 없음)"}
                      </p>
                      <p
                        className="mt-0.5 font-mono text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {m.member_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div
                        className="text-right text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {m.email && <p>{m.email}</p>}
                        {m.phone && <p>{m.phone}</p>}
                        {m.birth_date && <p>생년월일 {m.birth_date}</p>}
                        <p>
                          가입{" "}
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString("ko-KR")
                            : "-"}
                        </p>
                      </div>
                      <a
                        href={`/admin/members/${m.id}`}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--text)",
                          textDecoration: "none",
                        }}
                      >
                        상세
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
