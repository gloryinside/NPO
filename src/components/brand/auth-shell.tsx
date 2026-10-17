import type { ReactNode } from "react";
import { LogoWithText } from "./logo-with-text";

interface AuthShellProps {
  /** 로고 위 작은 대문자 라벨 */
  eyebrow: string;
  /** 로고 아래 한 줄 안내 */
  tagline?: string;
  /** 좌측 딥네이비 패널 일러스트(public 경로). 파일이 없으면 그라디언트만 보인다. */
  art?: string;
  children: ReactNode;
}

/**
 * 인증 화면 셸 — JobYLW 로그인과 같은 구성.
 * 데스크톱: 좌측 딥네이비 일러스트 패널 + 우측 점 격자 위 폼 카드. 모바일: 폼만.
 * 일러스트는 CSS 배경으로 깔아 파일이 아직 없어도 깨진 이미지 아이콘이 생기지 않는다.
 */
export function AuthShell({ eyebrow, tagline, art = "/img/auth/side.webp", children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-[38%_1fr]">
      <aside
        aria-hidden
        className="surface-dark relative hidden overflow-hidden lg:block"
      >
        <div className="dot-grid-light absolute inset-0 opacity-[0.06]" />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${art}")` }}
        />
      </aside>

      <section className="relative flex items-center justify-center px-4 py-12">
        <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-0 opacity-40" />
        <div className="animate-rise relative w-full max-w-[24rem]">
          <div className="mb-6 text-center">
            <p className="eyebrow">{eyebrow}</p>
            <div className="mt-3 flex justify-center text-[var(--text)]">
              <LogoWithText variant="header" size="lg" />
            </div>
            {tagline && (
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">{tagline}</p>
            )}
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
