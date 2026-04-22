'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_MAX_AGE_SECONDS,
  type ThemePreference,
} from '@/lib/theme/preference';

interface ThemeToggleProps {
  persistToServer?: boolean;
  className?: string;
}

function readCurrentPreference(): ThemePreference {
  if (typeof document === 'undefined') return 'system';
  const m = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=(light|dark|system)`),
  );
  if (m) return m[1] as ThemePreference;
  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(THEME_COOKIE_NAME)
      : null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    const isDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  return pref;
}

function writeCookie(value: ThemePreference, isProduction: boolean): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const secure = isProduction ? '; Secure' : '';
    document.cookie = `${THEME_COOKIE_NAME}=${value}; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    return true;
  } catch {
    return false;
  }
}

function writeLocalStorage(value: ThemePreference): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_COOKIE_NAME, value);
    }
  } catch {
    // silent
  }
}

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: '라이트 테마', Icon: Sun },
  { value: 'system', label: 'OS 설정 따르기', Icon: Monitor },
  { value: 'dark', label: '다크 테마', Icon: Moon },
];

export function ThemeToggle({ persistToServer = false, className }: ThemeToggleProps) {
  const [current, setCurrent] = useState<ThemePreference>('system');

  useEffect(() => {
    setCurrent(readCurrentPreference());
  }, []);

  useEffect(() => {
    if (current !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.setAttribute(
        'data-theme',
        mq.matches ? 'dark' : 'light',
      );
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [current]);

  async function apply(pref: ThemePreference) {
    setCurrent(pref);
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOk = writeCookie(pref, isProduction);
    if (!cookieOk) writeLocalStorage(pref);

    if (persistToServer) {
      try {
        await fetch('/api/donor/theme', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preference: pref }),
        });
      } catch (e) {
        console.warn('[theme-toggle] server persist failed', e);
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={className}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 6,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => apply(value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--muted-foreground)',
              boxShadow: active ? '0 1px 2px rgb(0 0 0 / 0.05)' : undefined,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
