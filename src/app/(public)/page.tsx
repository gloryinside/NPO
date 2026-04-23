import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingRenderer } from "@/components/landing-builder/LandingRenderer";
import { migrateToV2 } from "@/lib/landing-migrate";
import type { LandingPageContent } from "@/types/landing";

export const revalidate = 60;

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
  published_content: unknown;
  page_content: unknown;
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

export default async function PublicPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const tenant = await getTenant();
  const { draft } = await searchParams;
  const isDraftRequest = draft === "1";

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
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium text-white bg-[var(--accent)] transition-colors"
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
        "name, tagline, about, logo_url, hero_image_url, contact_email, contact_phone, address, business_no, show_stats, published_content, page_content"
      )
      .eq("id", tenant.id)
      .single(),
    supabase
      .from("campaigns")
      .select("id, title, slug, description, status, goal_amount, started_at, ended_at, thumbnail_url")
      .eq("org_id", tenant.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),
    adminSupabase
      .from("payments")
      .select("amount, member_id, campaign_id")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid"),
  ]);

  const org = orgData as OrgRow | null;
  const campaignList = (campaigns as unknown as CampaignRow[]) ?? [];
  const statsRows = statsResult.data ?? [];

  // ── draft 모드: 관리자 세션이면서 ?draft=1 일 때 편집 중 콘텐츠를 미리보기 ──
  // 일반 방문자는 항상 published_content만 본다.
  const adminUser = isDraftRequest ? await getAdminUser() : null;
  const useDraft = isDraftRequest && adminUser?.user_metadata?.role === "admin";

  const sourceContent = useDraft
    ? (org?.page_content as LandingPageContent | null | undefined)
    : (org?.published_content as LandingPageContent | null | undefined);

  const hasSections =
    sourceContent &&
    typeof sourceContent === "object" &&
    "sections" in sourceContent &&
    Array.isArray(sourceContent.sections) &&
    sourceContent.sections.length > 0;

  // ── 캠페인 모금액 집계 (섹션 렌더러 + 기본 렌더러 공통) ─────────────
  const paidByCampaign = new Map<string, number>();
  for (const row of statsRows) {
    if (row.campaign_id) {
      const k = row.campaign_id as string;
      paidByCampaign.set(k, (paidByCampaign.get(k) ?? 0) + Number(row.amount ?? 0));
    }
  }

  const campaignRowsForRenderer = campaignList.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    goal_amount: c.goal_amount,
    ended_at: c.ended_at,
    thumbnail_url: c.thumbnail_url,
    raised: paidByCampaign.get(c.id) ?? 0,
  }));

  // ── 섹션 빌더 렌더러로 표시 ───────────────────────────────────────────
  if (hasSections) {
    const footerOrg = org!;
    return (
      <main className="bg-[var(--bg)] min-h-screen">
        {useDraft && (
          <div className="bg-[var(--warning)]/10 text-[var(--warning)] text-xs text-center py-2 px-4 border-b border-[var(--warning)]/20">
            📝 편집 중인 콘텐츠 미리보기 (아직 공개되지 않음)
          </div>
        )}
        <LandingRenderer
          sections={migrateToV2(sourceContent!).sections}
          campaigns={campaignRowsForRenderer}
        />

        {/* 푸터 */}
        {(footerOrg.business_no || footerOrg.address || footerOrg.contact_email || footerOrg.contact_phone) && (
          <footer className="text-xs text-center py-8 px-6 space-y-1 text-[var(--muted-foreground)] border-t border-[var(--border)]">
            <div className="font-medium text-[var(--text)]">{footerOrg.name}</div>
            {footerOrg.business_no && <div>사업자등록번호: {footerOrg.business_no}</div>}
            {footerOrg.address && <div>{footerOrg.address}</div>}
            <div className="flex justify-center gap-4 flex-wrap">
              {footerOrg.contact_phone && <span>전화: {footerOrg.contact_phone}</span>}
              {footerOrg.contact_email && <span>이메일: {footerOrg.contact_email}</span>}
            </div>
          </footer>
        )}
      </main>
    );
  }

  // ── 기본 정적 렌더러 (섹션 없음) ─────────────────────────────────────
  const totalRaised = statsRows.reduce((s: number, r: { amount: number | null }) => s + Number(r.amount ?? 0), 0);
  const uniqueDonors = new Set(statsRows.map((r: { member_id: string | null }) => r.member_id).filter(Boolean)).size;
  const showStats = org?.show_stats !== false;

  const heroBg = org?.hero_image_url
    ? `linear-gradient(to bottom, rgba(10,10,15,0.6), rgba(10,10,15,0.9)), url(${JSON.stringify(org.hero_image_url)}) center/cover no-repeat`
    : "var(--surface)";

  return (
    <main className="bg-[var(--bg)] min-h-screen">
      {/* Hero */}
      <section
        className="relative border-b border-[var(--border)] [background:var(--hero-bg)]"
        style={{ '--hero-bg': heroBg } as React.CSSProperties}
      >
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          {/* G-D89: next/image 로 최적화 (LCP 개선) */}
          {org?.logo_url && (
            <Image
              src={org.logo_url}
              alt={`${org.name ?? tenant.name} 로고`}
              width={200}
              height={64}
              priority
              className="h-16 w-auto mx-auto mb-6 object-contain"
              unoptimized={org.logo_url.endsWith(".svg")}
            />
          )}
          <h1 className="text-4xl font-bold mb-4 text-[var(--text)]">
            {org?.tagline ?? `${org?.name ?? tenant.name}의 후원 캠페인`}
          </h1>
          {org?.about && (
            <p className="text-base max-w-2xl mx-auto mb-8 text-[var(--muted-foreground)]">
              {org.about.slice(0, 200)}{org.about.length > 200 ? "…" : ""}
            </p>
          )}
          <Link
            href="#campaigns"
            className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] transition-opacity hover:opacity-90"
          >
            후원하기 →
          </Link>
        </div>
      </section>

      {/* 누적 후원 현황 */}
      {showStats && (totalRaised > 0 || uniqueDonors > 0) && (
        <section className="bg-[var(--surface)] border-b border-[var(--border)]">
          <div className="max-w-4xl mx-auto px-6 py-10 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-6 text-[var(--muted-foreground)]">
              후원 현황
            </h2>
            <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
              <div>
                <div className="text-3xl font-bold text-[var(--accent)]">
                  {uniqueDonors.toLocaleString("ko-KR")}명
                </div>
                <div className="text-sm mt-1 text-[var(--muted-foreground)]">누적 후원자</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[var(--accent)]">
                  {formatKRW(totalRaised)}
                </div>
                <div className="text-sm mt-1 text-[var(--muted-foreground)]">누적 후원금</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 캠페인 목록 */}
      <section id="campaigns" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">
          진행 중인 캠페인
        </h2>
        <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">
          아래 캠페인에 참여하여 소중한 나눔을 실천해 보세요.
        </p>
        {campaignList.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">
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
                <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} className="block group no-underline">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full flex flex-col transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
                    {campaign.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={campaign.thumbnail_url}
                        alt={campaign.title}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)]" />
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold leading-snug text-[var(--text)]">
                          {campaign.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {campaign.ended_at && (() => {
                            const daysLeft = Math.ceil((new Date(campaign.ended_at).getTime() - Date.now()) / 86400000);
                            return daysLeft >= 0 ? (
                              <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)]">
                                D-{daysLeft}
                              </span>
                            ) : null;
                          })()}
                          <Badge className="border-0 text-xs bg-[var(--positive)]/10 text-[var(--positive)]">
                            진행 중
                          </Badge>
                        </div>
                      </div>
                      {campaign.description && (
                        <p className="text-sm line-clamp-2 mb-3 flex-1 text-[var(--muted-foreground)]">
                          {campaign.description}
                        </p>
                      )}
                      {pct !== null && (
                        <div className="mt-auto mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--muted-foreground)]">
                              {formatKRW(raised)}
                            </span>
                            <span className="text-[var(--muted-foreground)]">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs mt-1 text-right text-[var(--muted-foreground)]">
                            목표 {formatKRW(campaign.goal_amount ?? 0)}
                          </div>
                        </div>
                      )}
                      <span className="text-sm font-semibold mt-auto text-[var(--accent)]">
                        후원하기 →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 후원 방법 안내 */}
      <section className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h2 className="text-xl font-bold mb-8 text-[var(--text)]">후원 방법 안내</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            {[
              {
                step: "1",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                ),
                title: "캠페인 선택",
                desc: "후원하고 싶은 캠페인을 선택하세요.",
              },
              {
                step: "2",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                ),
                title: "정보 입력",
                desc: "이름과 연락처를 입력하고 후원 금액을 정합니다.",
              },
              {
                step: "3",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                ),
                title: "결제 완료",
                desc: "카드·계좌이체·CMS 자동이체로 간편하게 결제합니다.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white bg-[var(--accent)]">
                  {s.icon}
                </div>
                <div className="font-semibold text-[var(--text)]">{s.title}</div>
                <div className="text-[var(--muted-foreground)]">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 푸터 */}
      {org && (org.business_no || org.address || org.contact_email || org.contact_phone) && (
        <footer className="text-xs text-center py-8 px-6 space-y-1 text-[var(--muted-foreground)] border-t border-[var(--border)]">
          <div className="font-medium text-[var(--text)]">{org.name}</div>
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
