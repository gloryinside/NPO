import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";

export const metadata = { title: "공지사항" };

type Post = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ko-KR"); } catch { return iso; }
}

export default async function DonorNoticePage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const tenant = await getTenant();
  if (!tenant) redirect("/donor");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("board_posts")
    .select("id, title, body, pinned, published_at")
    .eq("org_id", tenant.id)
    .eq("post_type", "notice")
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(100);

  const posts = (data as Post[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <Link href="/donor/support" className="text-sm text-[var(--muted-foreground)]">
          ← 고객지원
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">공지사항</h1>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border p-5 ${
                p.pinned
                  ? "border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {p.pinned && (
                  <span className="text-xs font-semibold text-[var(--accent)]">📌</span>
                )}
                <h2 className="text-sm font-semibold text-[var(--text)]">{p.title}</h2>
                <time className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]">
                  {formatDate(p.published_at)}
                </time>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
