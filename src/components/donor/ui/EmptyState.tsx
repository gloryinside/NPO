import Image from "next/image";

// 빈 화면 선화 일러스트(public/img/empty) — 투명 배경이라 다크에서도 쓰고,
// 남색 선은 .art-adapt(globals.css)가 다크에서 밝게 뒤집는다.
export type EmptyIllustration =
  | "donors"
  | "payments"
  | "promises"
  | "receipts"
  | "campaigns"
  | "results"
  | "allclear";

const ILLUSTRATION: Record<EmptyIllustration, string> = {
  donors: "/img/empty/no-donors.webp",
  payments: "/img/empty/no-payments.webp",
  promises: "/img/empty/no-promises.webp",
  receipts: "/img/empty/no-receipts.webp",
  campaigns: "/img/empty/no-campaigns.webp",
  results: "/img/empty/no-results.webp",
  allclear: "/img/empty/all-clear.webp", // 처리할 것이 없음(좋은 상태)
};

/** 선화 일러스트 — 원본 비율이 제각각(1:1·3:2·2:1)이라 높이를 고정하고 너비는 비율대로 */
export function EmptyArt({
  name,
  className = "",
}: {
  name: EmptyIllustration;
  className?: string;
}) {
  return (
    <Image
      src={ILLUSTRATION[name]}
      alt=""
      width={480}
      height={320}
      className={`art-adapt mx-auto h-44 w-auto object-contain ${className}`}
    />
  );
}

/**
 * G-D23: 빈 상태 공용 컴포넌트
 *
 * 모든 donor 페이지의 "데이터 없음" 상태를 이 컴포넌트로 통일.
 * - illustration: 선화 일러스트(있으면 icon 대신 표시)
 * - icon: 이모지 1~2자 — 맞는 일러스트가 없을 때의 대체
 * - title: 빈 상태의 핵심 메시지
 * - description: 선택적 부연 설명
 * - cta: 선택적 행동 유도 (href + label)
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  cta,
}: {
  icon?: string;
  illustration?: EmptyIllustration;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center shadow-card">
      {illustration ? (
        <EmptyArt name={illustration} className="mb-4" />
      ) : (
        icon && (
          <p className="mb-3 text-5xl" aria-hidden>
            {icon}
          </p>
        )
      )}
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
          {description}
        </p>
      )}
      {cta && (
        <a
          href={cta.href}
          className="mt-6 inline-flex items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition-colors hover:bg-[var(--accent-hover)]"
        >
          {cta.label} →
        </a>
      )}
    </div>
  );
}
