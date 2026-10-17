import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { cookies, headers } from "next/headers";
import {
  parseThemePreference,
  THEME_COOKIE_NAME,
} from "@/lib/theme/preference";
// 한글 UI 폰트(자가 호스팅, 유니코드 범위별 분할 로드 — CSP font-src 'self' 호환)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 기관마다 도메인이 달라 metadataBase를 요청 호스트로 정한다 — 하위 페이지의 상대 경로 OG 이미지가 절대 URL이 된다
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: "에버후원금관리 — NPO 후원관리 플랫폼",
    description: "비영리단체를 위한 후원관리 SaaS",
  };
}

// 브라우저 크롬(주소창·상태바) 색을 페이지 배경과 일치
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const THEME_INIT_JS = `(function(){
  try {
    var m = document.cookie.match(/(?:^|;\\s*)npo_theme=(light|dark|system)/);
    var pref = m ? m[1] : (window.localStorage && localStorage.getItem('npo_theme')) || 'system';
    if (pref === 'system') {
      var sysIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', sysIsDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', pref);
    }
  } catch (e) {}
})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeCookieRaw = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const pref = parseThemePreference(themeCookieRaw);
  const initialTheme = pref === "light" || pref === "dark" ? pref : undefined;

  return (
    <html lang="ko" data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_JS}
        </Script>
      </head>
      <body>
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
