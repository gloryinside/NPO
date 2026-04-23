/**
 * G-D23: 빈 상태 공용 컴포넌트
 *
 * 모든 donor 페이지의 "데이터 없음" 상태를 이 컴포넌트로 통일.
 * - icon: 이모지 1~2자 권장
 * - title: 빈 상태의 핵심 메시지
 * - description: 선택적 부연 설명
 * - cta: 선택적 행동 유도 (href + label)
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: string;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      className="rounded-2xl border py-16 px-6 text-center"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p className="text-5xl mb-3" aria-hidden>
        {icon}
      </p>
      <p className="text-base font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </p>
      {description && (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {description}
        </p>
      )}
      {cta && (
        <a
          href={cta.href}
          className="mt-6 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", textDecoration: "none" }}
        >
          {cta.label} →
        </a>
      )}
    </div>
  );
}
