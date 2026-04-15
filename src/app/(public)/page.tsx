import Link from "next/link";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, title, slug, description, status, goal_amount, started_at, ended_at"
    )
    .eq("org_id", tenant.id)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  return (
    <main>
      {/* Hero */}
      <section className="py-20 text-center max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-[var(--text)] mb-4">
          {tenant.name}의 후원 캠페인
        </h1>
        <p className="text-lg text-[var(--muted-foreground)]">
          아래 캠페인에 참여하여 소중한 나눔을 실천해 보세요.
        </p>
      </section>

      {/* Campaign list */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        {!campaigns || campaigns.length === 0 ? (
          <p className="text-center text-[var(--muted-foreground)] py-12">
            진행 중인 캠페인이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.slug}`}
                className="block group"
              >
                <Card className="h-full transition-shadow group-hover:ring-[var(--accent)]/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                        {campaign.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-[var(--positive)] text-[var(--positive)]"
                      >
                        진행 중
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2">
                      {campaign.description ?? ""}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
