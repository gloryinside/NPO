import { redirect } from "next/navigation";
import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JsonForm } from "@/components/admin/json-form";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "내 P2P 모금 페이지" };

type Page = {
  id: string;
  campaign_id: string;
  slug: string;
  title: string;
  goal_amount: number | null;
  status: string;
  created_at: string;
  campaigns: { slug: string; title: string } | null;
};

export default async function DonorP2PPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const supabase = createSupabaseAdminClient();
  const [pagesRes, campaignsRes] = await Promise.all([
    supabase.from("p2p_pages")
      .select("id, campaign_id, slug, title, goal_amount, status, created_at, campaigns(slug, title)")
      .eq("org_id", session.member.org_id)
      .eq("owner_member_id", session.member.id)
      .order("created_at", { ascending: false }),
    supabase.from("campaigns")
      .select("id, slug, title")
      .eq("org_id", session.member.org_id)
      .eq("status", "active")
      .order("title"),
  ]);

  const pages = (pagesRes.data as unknown as Page[]) ?? [];
  const campaigns = (campaignsRes.data ?? []) as Array<{ id: string; slug: string; title: string }>;

  // 페이지별 모금 합계
  const ids = pages.map((p) => p.id);
  let totals = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pays } = await supabase
      .from("payments").select("p2p_page_id, amount")
      .eq("org_id", session.member.org_id)
      .eq("pay_status", "paid").in("p2p_page_id", ids);
    totals = new Map();
    for (const p of (pays ?? []) as Array<{ p2p_page_id: string | null; amount: number | null }>) {
      if (!p.p2p_page_id) continue;
      totals.set(p.p2p_page_id, (totals.get(p.p2p_page_id) ?? 0) + Number(p.amount ?? 0));
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text)]">내 P2P 모금 페이지</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          나만의 모금 페이지를 만들어 SNS에 공유하세요. 모금된 금액은 캠페인으로 합산됩니다.
        </p>
      </header>

      {pages.length === 0 ? (
        <p className="rounded-2xl border py-8 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          아직 만든 페이지가 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {pages.map((p) => {
            const raised = totals.get(p.id) ?? 0;
            const url = `/c/${p.campaigns?.slug}/p/${p.slug}`;
            return (
              <li key={p.id} className="rounded-2xl border p-5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[var(--text)]">{p.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {p.campaigns?.title} · {p.status === "active" ? "공개중" : "닫힘"}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--text)" }}>
                      모금 <b>{formatKRW(raised)}</b>
                      {p.goal_amount && (
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          / 목표 {formatKRW(Number(p.goal_amount))}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link href={url} target="_blank" rel="noreferrer"
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ background: "var(--accent)", textDecoration: "none" }}>
                    내 페이지 보기 ↗
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 P2P 페이지 만들기</h2>
        <div className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <JsonForm
            url="/api/donor/p2p-pages"
            fields={[
              {
                name: "campaignId", label: "캠페인", type: "select", required: true,
                options: campaigns.map((c) => ({ value: c.id, label: c.title })),
              },
              { name: "slug", label: "URL slug", required: true,
                helpText: "영소문자/숫자/하이픈 (예: john-wedding)" },
              { name: "title", label: "페이지 제목", required: true,
                placeholder: "제 결혼식 대신 함께해주세요" },
              { name: "goalAmount", label: "개인 목표(원)", type: "number", min: 0 },
              { name: "story", label: "이야기", type: "textarea", rows: 5 },
              { name: "coverImageUrl", label: "표지 이미지 URL" },
            ]}
            submitLabel="페이지 생성"
            successMessage="생성됨"
          />
        </div>
      </section>
    </div>
  );
}
