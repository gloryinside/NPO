import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns").select("id, title").eq("slug", slug).maybeSingle();
  if (!campaign) return { title: "P2P" };
  const { data: page } = await supabase
    .from("p2p_pages").select("title").eq("campaign_id", campaign.id).eq("slug", pageSlug).maybeSingle();
  return { title: page?.title ?? "P2P 모금" };
}

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export default async function P2PPublicPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, org_id, title, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!campaign) return notFound();

  const { data: page } = await supabase
    .from("p2p_pages")
    .select("id, title, story, goal_amount, cover_image_url, owner_member_id, members:owner_member_id(name)")
    .eq("campaign_id", campaign.id)
    .eq("slug", pageSlug)
    .eq("status", "active")
    .maybeSingle();
  if (!page) return notFound();

  const [paysRes, supportersRes] = await Promise.all([
    supabase.from("payments").select("amount")
      .eq("org_id", campaign.org_id).eq("p2p_page_id", page.id).eq("pay_status", "paid"),
    supabase.from("p2p_supporters")
      .select("display_name, amount, message, show_amount, created_at")
      .eq("p2p_page_id", page.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const raised = (paysRes.data ?? []).reduce(
    (acc: number, p: { amount: number | null }) => acc + Number(p.amount ?? 0),
    0,
  );
  const supporterCount = (paysRes.data ?? []).length;
  const goal = Number(page.goal_amount ?? 0);
  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : null;
  const ownerName = (page as { members?: { name?: string } | null }).members?.name ?? "후원자";
  const supporters = (supportersRes.data ?? []) as Array<{
    display_name: string | null; amount: number;
    message: string | null; show_amount: boolean; created_at: string;
  }>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/c/${slug}`} className="text-xs text-[var(--muted-foreground)]">
        ← {campaign.title} 캠페인으로
      </Link>

      <header className="mt-3">
        <h1 className="text-2xl font-bold text-[var(--text)]">{page.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          <b>{ownerName}</b>님의 P2P 모금
        </p>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {page.cover_image_url && <img src={page.cover_image_url} alt=""
        className="mt-4 w-full rounded-2xl object-cover" />}

      <section className="mt-6 rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-sm text-[var(--muted-foreground)]">현재 모금액</p>
        <p className="mt-1 text-3xl font-bold text-[var(--text)]">{formatKRW(raised)}</p>
        {goal > 0 && (
          <>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              목표 {formatKRW(goal)} · {supporterCount}명 참여
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className="h-full" style={{ width: `${pct ?? 0}%`, background: "var(--accent)" }} />
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{(pct ?? 0).toFixed(1)}% 달성</p>
          </>
        )}
        <Link
          href={`/donate/wizard?campaignSlug=${slug}&p2pPageId=${page.id}`}
          className="mt-4 inline-block w-full rounded-xl px-6 py-3 text-center text-base font-semibold text-white"
          style={{ background: "var(--accent)", textDecoration: "none" }}
        >
          이 페이지로 후원하기 →
        </Link>
      </section>

      {page.story && (
        <section className="mt-6 rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">이야기</h2>
          <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--text)" }}>{page.story}</p>
        </section>
      )}

      {supporters.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">최근 후원자</h2>
          <ul className="space-y-2">
            {supporters.map((s, i) => (
              <li key={i} className="rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)" }}>{s.display_name ?? "익명"}</span>
                  {s.show_amount && (
                    <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                      {formatKRW(Number(s.amount))}
                    </span>
                  )}
                </div>
                {s.message && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{s.message}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
