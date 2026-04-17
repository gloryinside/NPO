'use client';
import { useState } from 'react';
import type { ThemeConfig } from '@/lib/theme/config';

const ACCENT_PRESETS = [
  { label: '보라', value: '#7c3aed' },
  { label: '파랑', value: '#2563eb' },
  { label: '빨강', value: '#dc2626' },
  { label: '초록', value: '#16a34a' },
  { label: '주황', value: '#ea580c' },
  { label: '분홍', value: '#db2777' },
];

export function ThemeSettingsForm({ initialData }: { initialData: ThemeConfig }) {
  const [mode, setMode] = useState<'dark' | 'light'>(initialData.mode);
  const [accent, setAccent] = useState(initialData.accent);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSave() {
    setSaveStatus('saving');
    const res = await fetch('/api/admin/settings/theme', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, accent, accentSoft: `rgba(${hexToRgb(accent)},0.12)` }),
    });
    setSaveStatus(res.ok ? 'saved' : 'error');
    if (res.ok) setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>디스플레이 모드</p>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded px-4 py-2 text-sm font-medium transition-opacity"
              style={mode === m
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
              }
            >
              {m === 'dark' ? '다크' : '라이트'}
            </button>
          ))}
        </div>
      </div>

      {/* Accent presets */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>강조 색상</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setAccent(p.value)}
              title={p.label}
              className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: p.value,
                borderColor: accent === p.value ? 'var(--text)' : 'transparent',
              }}
            />
          ))}
        </div>
        <input
          type="text"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          placeholder="#7c3aed"
          className="w-36 rounded px-3 py-1.5 text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {saveStatus === 'saving' ? '저장 중…' : '저장'}
        </button>
        {saveStatus === 'saved' && <span className="text-sm" style={{ color: 'var(--positive)' }}>저장되었습니다</span>}
        {saveStatus === 'error' && <span className="text-sm" style={{ color: 'var(--negative)' }}>저장 실패</span>}
      </div>
    </div>
  );
}
