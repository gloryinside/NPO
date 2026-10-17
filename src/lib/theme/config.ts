import { z } from 'zod';

// 색 값만 허용 — 이 값들은 <style> 안 CSS로 그대로 들어가므로 임의 문자열이면
// `}</style><script>…`로 태그를 탈출하는 저장형 XSS가 된다.
const CssColor = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/,
    '색상은 #hex 또는 rgb()/rgba() 형식이어야 합니다.',
  );

export const ThemeConfigSchema = z.object({
  mode: z.enum(['dark', 'light']).default('light'),
  accent: CssColor.default('#009944'),
  accentSoft: CssColor.default('#e9f7ef'),
  bg: CssColor.optional(),
  surface: CssColor.optional(),
  surfaceTwo: CssColor.optional(),
  text: CssColor.optional(),
  mutedForeground: CssColor.optional(),
  border: CssColor.optional(),
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const DARK_DEFAULTS: Required<Pick<ThemeConfig, 'bg' | 'surface' | 'surfaceTwo' | 'text' | 'mutedForeground' | 'border'>> = {
  bg: '#0b1220',
  surface: '#161f30',
  surfaceTwo: '#1e293b',
  text: '#e2e8f0',
  mutedForeground: '#94a3b8',
  border: '#26324a',
};

export const LIGHT_DEFAULTS: Required<Pick<ThemeConfig, 'bg' | 'surface' | 'surfaceTwo' | 'text' | 'mutedForeground' | 'border'>> = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceTwo: '#f1f5f9',
  text: '#0f172a',
  mutedForeground: '#64748b',
  border: '#e2e8f0',
};

export function defaultThemeConfig(): ThemeConfig {
  return ThemeConfigSchema.parse({});
}

/**
 * Converts a validated ThemeConfig to a CSS :root variable override string.
 * The output is injected as a <style> tag in the public layout.
 * NOTE: input must be a server-side validated ThemeConfig (not raw user input).
 */
export function themeConfigToCss(config: ThemeConfig): string {
  const modeDefaults = config.mode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS;

  const vars: Record<string, string> = {
    '--accent': config.accent,
    '--accent-soft': config.accentSoft,
    '--bg': config.bg ?? modeDefaults.bg,
    '--surface': config.surface ?? modeDefaults.surface,
    '--surface-2': config.surfaceTwo ?? modeDefaults.surfaceTwo,
    '--text': config.text ?? modeDefaults.text,
    '--muted-foreground': config.mutedForeground ?? modeDefaults.mutedForeground,
    '--border': config.border ?? modeDefaults.border,
  };

  const lines = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return `:root {\n${lines}\n}`;
}
