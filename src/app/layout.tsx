import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import {
  parseThemePreference,
  THEME_COOKIE_NAME,
} from "@/lib/theme/preference";
import "./globals.css";

export const metadata: Metadata = {
  title: "에버후원금관리 — NPO 후원관리 플랫폼",
  description: "비영리단체를 위한 후원관리 SaaS",
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
      <body>{children}</body>
    </html>
  );
}
