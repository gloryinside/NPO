export function ActionBannerSkeleton() {
  return (
    <div
      className="h-16 rounded-2xl animate-pulse"
      style={{ background: "var(--surface-2)" }}
      aria-hidden="true"
    />
  );
}

export function DashboardBodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-2xl animate-pulse"
          style={{ background: "var(--surface-2)" }}
        />
      ))}
    </div>
  );
}
