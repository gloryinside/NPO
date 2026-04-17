import { z } from 'zod';

export const ThemeConfigSchema = z.object({
  mode: z.enum(['dark', 'light']).default('dark'),
  accent: z.string().default('#7c3aed'),
  accentSoft: z.string().default('rgba(124,58,237,0.12)'),
  bg: z.string().optional(),
  surface: z.string().optional(),
  surfaceTwo: z.string().optional(),
  text: z.string().optional(),
  mutedForeground: z.string().optional(),
  border: z.string().optional(),
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const DARK_DEFAULTS: Required<Pick<ThemeConfig, 'bg' | 'surface' | 'surfaceTwo' | 'text' | 'mutedForeground' | 'border'>> = {
  bg: '#0f0f12',
  surface: '#1a1a24',
  surfaceTwo: '#252535',
  text: '#f0f0f5',
  mutedForeground: '#9090a8',
  border: '#2e2e42',
};

export const LIGHT_DEFAULTS: Required<Pick<ThemeConfig, 'bg' | 'surface' | 'surfaceTwo' | 'text' | 'mutedForeground' | 'border'>> = {
  bg: '#f8f8fc',
  surface: '#ffffff',
  surfaceTwo: '#f0f0f8',
  text: '#1a1a2e',
  mutedForeground: '#606078',
  border: '#e0e0f0',
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
