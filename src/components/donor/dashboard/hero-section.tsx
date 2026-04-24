import type { DonorDashboardSnapshot } from "@/types/dashboard";
import { getT } from "@/lib/i18n/donor";

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function calcDaysUntilNext(
  upcoming: DonorDashboardSnapshot["upcoming_payments"],
): number | null {
  if (upcoming.length === 0) return null;
  const target = new Date(upcoming[0].scheduled_date);
  const diff = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return diff > 0 ? diff : null;
}

function getGreetingKey(): string {
  const hStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const h = Number(hStr);
  if (h < 12) return "donor.dashboard.greeting.morning";
  if (h < 18) return "donor.dashboard.greeting.afternoon";
  return "donor.dashboard.greeting.evening";
}

interface HeroSectionProps {
  memberName: string;
  snapshot: DonorDashboardSnapshot;
}

export async function HeroSection({ memberName, snapshot }: HeroSectionProps) {
  const t = await getT();
  const greeting = t(getGreetingKey());
  const daysUntilNext = calcDaysUntilNext(snapshot.upcoming_payments);
  const upcomingTotal = snapshot.upcoming_payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  const secondaryStats: { label: string; value: string }[] = [
    {
      label: t("donor.dashboard.stats.active_pledges"),
      value: `${snapshot.active_promises.length}${t("donor.dashboard.stats.active_unit")}`,
    },
    {
      label: t("donor.dashboard.stats.upcoming"),
      value:
        snapshot.upcoming_payments.length > 0
          ? formatAmount(upcomingTotal)
          : t("donor.dashboard.stats.upcoming_none"),
    },
  ];

  if (snapshot.streak >= 3) {
    secondaryStats.push({
      label: t("donor.dashboard.stats.streak"),
      value: `${snapshot.streak}${t("donor.dashboard.stats.streak_suffix")}`,
    });
  } else if (daysUntilNext !== null) {
    secondaryStats.push({
      label: t("donor.dashboard.stats.next_payment"),
      value: `D-${daysUntilNext}`,
    });
  }

  return (
    <section
      className="rounded-2xl p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
        border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
      }}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-5 sm:gap-8">
        {/* 좌측 — 인사 + 주 지표 (3/5) */}
        <div className="sm:col-span-3">
          <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            {greeting}
          </p>
          <h1
            className="mt-1 text-2xl font-bold"
            style={{ color: "var(--text)" }}
          >
            {memberName}
            {t("donor.dashboard.hero.honorific")}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("donor.dashboard.hero.subtitle")}
          </p>

          <div className="mt-6">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("donor.dashboard.stats.total_donated")}
            </p>
            <p
              className="mt-1 text-4xl font-bold sm:text-5xl"
              style={{ color: "var(--accent)" }}
            >
              {formatAmount(snapshot.total_paid)}
            </p>
          </div>
        </div>

        {/* 우측 — 보조 지표 세로 스택 (2/5) */}
        <div className="space-y-2 sm:col-span-2">
          {secondaryStats.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{
                background:
                  "color-mix(in srgb, var(--surface) 70%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
              }}
            >
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {s.label}
              </span>
              <span
                className="text-base font-semibold"
                style={{ color: "var(--text)" }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
