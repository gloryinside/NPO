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

  return (
    <section
      className="rounded-2xl p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
        border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
        {greeting} <span aria-hidden="true">👋</span>
      </p>
      <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--text)" }}>
        {memberName}
        {t("donor.dashboard.hero.honorific")}
      </h1>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        {t("donor.dashboard.hero.subtitle")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          label={t("donor.dashboard.stats.total_donated")}
          value={formatAmount(snapshot.total_paid)}
          accent
        />
        <StatPill
          label={t("donor.dashboard.stats.active_pledges")}
          value={`${snapshot.active_promises.length}${t("donor.dashboard.stats.active_unit")}`}
        />
        <StatPill
          label={t("donor.dashboard.stats.upcoming")}
          value={
            snapshot.upcoming_payments.length > 0
              ? formatAmount(upcomingTotal)
              : t("donor.dashboard.stats.upcoming_none")
          }
        />
        {snapshot.streak >= 3 ? (
          <StatPill
            label={t("donor.dashboard.stats.streak")}
            value={`🔥 ${snapshot.streak}${t("donor.dashboard.stats.streak_suffix")}`}
          />
        ) : daysUntilNext !== null ? (
          <StatPill
            label={t("donor.dashboard.stats.next_payment")}
            value={`D-${daysUntilNext}`}
          />
        ) : (
          <StatPill label="" value="" />
        )}
      </div>
    </section>
  );
}

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  if (!label && !value) {
    return <div aria-hidden="true" />;
  }
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: accent
          ? "var(--accent)"
          : "color-mix(in srgb, var(--surface) 70%, transparent)",
        border: accent
          ? "none"
          : "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      <p
        className="text-xs"
        style={{
          color: accent ? "rgba(255,255,255,0.75)" : "var(--muted-foreground)",
        }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold"
        style={{ color: accent ? "#fff" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}
