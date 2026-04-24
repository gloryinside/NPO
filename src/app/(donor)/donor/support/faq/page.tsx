import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";

export const metadata = { title: "FAQ" };

const CATEGORIES = [
  { value: "payment", label: "결제" },
  { value: "receipt", label: "영수증" },
  { value: "donation", label: "후원" },
  { value: "account", label: "계정" },
  { value: "other", label: "기타" },
];

type Post = {
  id: string;
  category: string | null;
  title: string;
  body: string;
  pinned: boolean;
};

export default async function DonorFaqPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const tenant = await getTenant();
  if (!tenant) redirect("/donor");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("board_posts")
    .select("id, category, title, body, pinned")
    .eq("org_id", tenant.id)
    .eq("post_type", "faq")
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const posts = (data as Post[]) ?? [];

  // 카테고리별 그룹핑
  const grouped = new Map<string, Post[]>();
  for (const p of posts) {
    const cat = p.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <Link href="/donor/support" className="text-sm text-[var(--muted-foreground)]">
          ← 고객지원
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">자주 묻는 질문</h1>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          등록된 FAQ가 없습니다.
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.filter((c) => grouped.has(c.value)).map((c) => (
            <section key={c.value}>
              <h2 className="mb-3 text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                {c.label}
              </h2>
              <ul className="space-y-2">
                {grouped.get(c.value)!.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <details className="group">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                        <span className="text-sm font-medium text-[var(--text)]">
                          {p.pinned && <span className="mr-1 text-[var(--accent)]">📌</span>}
                          {p.title}
                        </span>
                        <span className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </summary>
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">
                          {p.body}
                        </p>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {/* 카테고리 없는 항목 */}
          {grouped.has("other") && !CATEGORIES.find((c) => c.value === "other" && grouped.has("other")) && null}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          찾으시는 내용이 없으신가요?{" "}
          <Link href="/donor/support/inquiries/new" className="text-[var(--accent)] underline">
            문의하기
          </Link>
        </p>
      </div>
    </div>
  );
}
