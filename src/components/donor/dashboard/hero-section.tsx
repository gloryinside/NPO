import type { DonorDashboardSnapshot } from "@/types/dashboard";

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

function getGreeting(): string {
  const hStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const h = Number(hStr);
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "안녕하세요";
  return "좋은 저녁이에요";
}

interface HeroSectionProps {
  memberName: string;
  snapshot: DonorDashboardSnapshot;
}

export function HeroSection({ memberName, snapshot }: HeroSectionProps) {
  const greeting = getGreeting();
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
        {memberName}님
      </h1>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        지금까지의 후원이 세상을 바꾸고 있습니다.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          label="누적 후원액"
          value={formatAmount(snapshot.total_paid)}
          accent
        />
        <StatPill
          label="활성 약정"
          value={`${snapshot.active_promises.length}건`}
        />
        <StatPill
          label="이번 달 예정"
          value={
            snapshot.upcoming_payments.length > 0
              ? formatAmount(upcomingTotal)
              : "없음"
          }
        />
        {snapshot.streak >= 3 ? (
          <StatPill
            label="연속 후원"
            value={`🔥 ${snapshot.streak}개월`}
          />
        ) : daysUntilNext !== null ? (
          <StatPill label="다음 결제" value={`D-${daysUntilNext}`} />
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
    // placeholder - grid 정렬 유지용 빈 칸
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
