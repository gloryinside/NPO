import Link from "next/link";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: "🤝",
    title: "후원자 관리",
    description: "후원자 정보를 체계적으로 등록하고 관리하세요.",
  },
  {
    icon: "📣",
    title: "캠페인 운영",
    description: "다양한 후원 캠페인을 손쉽게 개설하고 운영하세요.",
  },
  {
    icon: "🧾",
    title: "기부금 영수증",
    description: "세법에 맞는 기부금 영수증을 자동으로 발급하세요.",
  },
];

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

type OrgRow = {
  name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  business_no: string | null;
  show_stats: boolean;
};

type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  goal_amount: number | null;
  started_at: string | null;
  ended_at: string | null;
  thumbnail_url: string | null;
};

export default async function PublicPage() {
  const tenant = await getTenant();

  // ── 플랫폼 랜딩 (테넌트 없음) ────────────────────────────────────────
  if (!tenant) {
    return (
      <main>
        {/* Hero */}
        <section className="py-20 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-4xl font-bold text-[var(--text)] mb-4">
            비영리단체를 위한 후원관리 플랫폼
          </h1>
          <p className="text-lg text-[var(--muted-foreground)] mb-8">
            후원자 등록부터 영수증 발급까지, 하나의 플랫폼에서
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors"
            style={{ background: "var(--accent)" }}
          >
            시작하기
          </Link>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <CardTitle>
                    <span className="mr-2 text-xl">{f.icon}</span>
                    {f.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    );
  }

  // ── 기관 랜딩 (테넌트 있음) ───────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();

  const [{ data: orgData }, { data: campaigns }, statsResult] = await Promise.all([
    adminSupabase
      .from("orgs")
      .select(
        "name, tagline, about, logo_url, hero_image_url, contact_email, contact_phone, address, business_no, show_stats"
      )
      .eq("id", tenant.id)
      .single(),
    supabase
      .from("campaigns")
      .select("id, title, slug, description, status, goal_amount, started_at, ended_at, thumbnail_url")
      .eq("org_id", tenant.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),
    // 누적 후원 현황
    adminSupabase
      .from("payments")
      .select("amount, member_id")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid"),
  ]);

  const org = orgData as OrgRow | null;
  const campaignList = (campaigns as unknown as CampaignRow[]) ?? [];

  // 누적 통계
  const statsRows = statsResult.data ?? [];
  const totalRaised = statsRows.reduce((s: number, r: { amount: number | null }) => s + Number(r.amount ?? 0), 0);
  const uniqueDonors = new Set(statsRows.map((r: { member_id: string | null }) => r.member_id).filter(Boolean)).size;

  // 캠페인별 달성률 계산
  const campaignIds = campaignList.map((c) => c.id);
  const paidByCampaign = new Map<string, number>();
  if (campaignIds.length > 0) {
    const { data: campaignPaid } = await adminSupabase
      .from("payments")
      .select("campaign_id, amount")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid")
      .in("campaign_id", campaignIds);
    for (const row of campaignPaid ?? []) {
      const k = row.campaign_id as string;
      paidByCampaign.set(k, (paidByCampaign.get(k) ?? 0) + Number(row.amount ?? 0));
    }
  }

  const showStats = org?.show_stats !== false;

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Hero */}
      <section
        className="relative"
        style={{
          background: org?.hero_image_url
            ? `linear-gradient(to bottom, rgba(10,10,15,0.6), rgba(10,10,15,0.9)), url(${JSON.stringify(org.hero_image_url)}) center/cover no-repeat`
            : "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          {org?.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={org.logo_url}
              alt={`${org.name ?? tenant.name} 로고`}
              className="h-16 w-auto mx-auto mb-6 object-contain"
            />
          )}
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text)" }}>
            {org?.tagline ?? `${org?.name ?? tenant.name}의 후원 캠페인`}
          </h1>
          {org?.about && (
            <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: "var(--muted-foreground)" }}>
              {org.about.slice(0, 200)}{org.about.length > 200 ? "…" : ""}
            </p>
          )}
          <Link
            href="#campaigns"
            className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            후원하기 →
          </Link>
        </div>
      </section>

      {/* 누적 후원 현황 */}
      {showStats && (totalRaised > 0 || uniqueDonors > 0) && (
        <section style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="max-w-4xl mx-auto px-6 py-10 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: "var(--muted-foreground)" }}>
              후원 현황
            </h2>
            <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
              <div>
                <div className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
                  {uniqueDonors.toLocaleString("ko-KR")}명
                </div>
                <div className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>누적 후원자</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
                  {formatKRW(totalRaised)}
                </div>
                <div className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>누적 후원금</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 캠페인 목록 */}
      <section id="campaigns" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: "var(--text)" }}>
          진행 중인 캠페인
        </h2>
        <p className="text-sm text-center mb-10" style={{ color: "var(--muted-foreground)" }}>
          아래 캠페인에 참여하여 소중한 나눔을 실천해 보세요.
        </p>
        {campaignList.length === 0 ? (
          <p className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
            진행 중인 캠페인이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaignList.map((campaign) => {
              const raised = paidByCampaign.get(campaign.id) ?? 0;
              const pct = campaign.goal_amount && campaign.goal_amount > 0
                ? Math.min(Math.round((raised / campaign.goal_amount) * 100), 100)
                : null;
              return (
                <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} className="block group" style={{ textDecoration: "none" }}>
                  <div
                    className="rounded-xl border overflow-hidden h-full flex flex-col transition-shadow group-hover:shadow-lg"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {campaign.thumbnail_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={campaign.thumbnail_url}
                        alt={campaign.title}
                        className="w-full h-40 object-cover"
                      />
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3
                          className="text-base font-semibold leading-snug group-hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text)" }}
                        >
                          {campaign.title}
                        </h3>
                        <Badge
                          className="shrink-0 border-0 text-xs"
                          style={{ background: "rgba(34,197,94,0.12)", color: "var(--positive)" }}
                        >
                          진행 중
                        </Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-sm line-clamp-2 mb-3 flex-1" style={{ color: "var(--muted-foreground)" }}>
                          {campaign.description}
                        </p>
                      )}
                      {/* 목표 달성률 바 */}
                      {pct !== null && (
                        <div className="mt-auto">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: "var(--muted-foreground)" }}>
                              {formatKRW(raised)}
                            </span>
                            <span style={{ color: "var(--muted-foreground)" }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: "var(--accent)" }}
                            />
                          </div>
                          <div className="text-xs mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>
                            목표 {formatKRW(campaign.goal_amount ?? 0)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 후원 방법 안내 */}
      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h2 className="text-xl font-bold mb-8" style={{ color: "var(--text)" }}>후원 방법 안내</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            {[
              { step: "1", title: "캠페인 선택", desc: "후원하고 싶은 캠페인을 선택하세요." },
              { step: "2", title: "정보 입력", desc: "이름과 연락처를 입력하고 후원 금액을 정합니다." },
              { step: "3", title: "결제 완료", desc: "카드·계좌이체·CMS 자동이체로 간편하게 결제합니다." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
                  style={{ background: "var(--accent)" }}
                >
                  {s.step}
                </div>
                <div className="font-semibold" style={{ color: "var(--text)" }}>{s.title}</div>
                <div style={{ color: "var(--muted-foreground)" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 푸터 */}
      {org && (org.business_no || org.address || org.contact_email || org.contact_phone) && (
        <footer
          className="text-xs text-center py-8 px-6 space-y-1"
          style={{ color: "var(--muted-foreground)", borderTop: "1px solid var(--border)" }}
        >
          <div className="font-medium" style={{ color: "var(--text)" }}>{org.name}</div>
          {org.business_no && <div>사업자등록번호: {org.business_no}</div>}
          {org.address && <div>{org.address}</div>}
          <div className="flex justify-center gap-4 flex-wrap">
            {org.contact_phone && <span>전화: {org.contact_phone}</span>}
            {org.contact_email && <span>이메일: {org.contact_email}</span>}
          </div>
        </footer>
      )}
    </main>
  );
}
