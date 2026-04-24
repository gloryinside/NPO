import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import Link from "next/link";
import type { MemberType, MemberStatus } from "@/types/member";

export const metadata = { title: "CRM — 잠재 후원자 · 자원봉사자" };

const TYPE_LABEL: Record<MemberType, string> = {
  individual: "개인",
  corporate: "법인",
  volunteer: "자원봉사자",
  prospect: "잠재후원자",
};

const TYPE_CLASS: Record<MemberType, string> = {
  individual: "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]",
  corporate: "bg-[color-mix(in_srgb,#8b5cf6_12%,transparent)] text-[#8b5cf6]",
  volunteer: "bg-[color-mix(in_srgb,#22c55e_12%,transparent)] text-[#22c55e]",
  prospect: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "활성",
  inactive: "비활성",
  deceased: "사망",
};

type Row = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  member_type: MemberType;
  status: MemberStatus;
  join_path: string | null;
  note: string | null;
  created_at: string;
};

export default async function CrmPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [volunteersRes, prospectsRes] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, phone, email, member_type, status, join_path, note, created_at")
      .eq("org_id", tenant.id)
      .eq("member_type", "volunteer")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("members")
      .select("id, name, phone, email, member_type, status, join_path, note, created_at")
      .eq("org_id", tenant.id)
      .eq("member_type", "prospect")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const volunteers = (volunteersRes.data ?? []) as Row[];
  const prospects = (prospectsRes.data ?? []) as Row[];

  return (
    <div className="space-y-8">
      <PageHeader
        title="CRM"
        description="잠재 후원자와 자원봉사자를 관리합니다."
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "자원봉사자", count: volunteers.length, type: "volunteer" as MemberType },
          {
            label: "잠재후원자",
            count: prospects.length,
            type: "prospect" as MemberType,
          },
          {
            label: "활성 잠재후원자",
            count: prospects.filter((p) => p.status === "active").length,
            type: "prospect" as MemberType,
          },
          {
            label: "활성 봉사자",
            count: volunteers.filter((v) => v.status === "active").length,
            type: "volunteer" as MemberType,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{s.count}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLASS[s.type]}`}
            >
              {TYPE_LABEL[s.type]}
            </span>
          </div>
        ))}
      </div>

      {/* Volunteers */}
      <MemberSegmentTable
        title="자원봉사자"
        rows={volunteers}
        emptyText="등록된 자원봉사자가 없습니다."
      />

      {/* Prospects */}
      <MemberSegmentTable
        title="잠재 후원자"
        rows={prospects}
        emptyText="등록된 잠재 후원자가 없습니다."
      />
    </div>
  );
}

function MemberSegmentTable({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Row[];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">{title}</h2>
        <Link
          href={`/admin/members/new`}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] no-underline hover:text-[var(--text)]"
        >
          + 등록
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">{emptyText}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 text-left font-medium">이름</th>
                <th className="px-4 py-3 text-left font-medium">연락처</th>
                <th className="px-4 py-3 text-left font-medium">유형</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">유입경로</th>
                <th className="px-4 py-3 text-left font-medium">메모</th>
                <th className="px-4 py-3 text-left font-medium">등록일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{m.name}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    <p>{m.phone ?? "—"}</p>
                    {m.email && <p className="text-xs">{m.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLASS[m.member_type]}`}
                    >
                      {TYPE_LABEL[m.member_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {STATUS_LABEL[m.status]}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{m.join_path ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-[var(--muted-foreground)]">
                    {m.note ?? ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {new Date(m.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)] no-underline hover:text-[var(--accent)]"
                    >
                      보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
