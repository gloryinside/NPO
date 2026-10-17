import PublicNav from "@/components/public/nav";
import { LogoWithText } from "@/components/brand/logo-with-text";
import {
  ThemeConfigSchema,
  defaultThemeConfig,
  themeConfigToCss,
} from "@/lib/theme/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("theme_config")
    .limit(1)
    .single();

  const themeConfig =
    data?.theme_config != null
      ? (() => {
          const parsed = ThemeConfigSchema.safeParse(data.theme_config);
          return parsed.success ? parsed.data : defaultThemeConfig();
        })()
      : defaultThemeConfig();

  const cssString = themeConfigToCss(themeConfig);

  return (
    <div
      style={{ background: "var(--bg)", color: "var(--text)" }}
      className="min-h-screen"
    >
      {/* cssString is server-generated from Zod-validated config, never raw user input */}
      <style dangerouslySetInnerHTML={{ __html: cssString }} />
      <PublicNav />
      {children}
      {/* 딥네이비 푸터 — JobYLW 공통 푸터 톤 */}
      <footer className="bg-[var(--footer-bg)] px-6 py-8 text-center text-xs text-white/60">
        <a
          href="/"
          className="inline-flex items-center text-white/80 no-underline transition-colors hover:text-white"
        >
          <LogoWithText variant="footer" size="sm" />
        </a>
      </footer>
    </div>
  );
}
