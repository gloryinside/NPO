'use client';

const ICONS = ['heart', 'users', 'globe', 'home', 'book', 'utensils', 'droplet', 'shield'] as const;

export function ImpactStatsPropsForm({ block, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });

  const inputStyle = { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' } as const;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text)' }}>섹션 제목</span>
        <input
          className="w-full rounded px-2 py-1 text-sm"
          style={inputStyle}
          value={p.heading ?? ''}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </label>
      {p.items.map((it: any, i: number) => (
        <div key={i} className="space-y-1 rounded p-2" style={{ border: '1px solid var(--border)' }}>
          <select
            className="w-full rounded px-1 text-sm"
            style={inputStyle}
            value={it.icon}
            onChange={(e) => {
              const items = [...p.items];
              items[i] = { ...it, icon: e.target.value };
              set({ items });
            }}
          >
            {ICONS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input
            className="w-full rounded px-1 text-sm"
            style={inputStyle}
            placeholder="값 (예: 1,234)"
            value={it.value}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, value: e.target.value }; set({ items }); }}
          />
          <input
            className="w-full rounded px-1 text-sm"
            style={inputStyle}
            placeholder="설명"
            value={it.label}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, label: e.target.value }; set({ items }); }}
          />
          <button
            onClick={() => set({ items: p.items.filter((_: unknown, j: number) => j !== i) })}
            className="text-xs" style={{ color: 'var(--negative)' }}
          >
            삭제
          </button>
        </div>
      ))}
      {p.items.length < 6 ? (
        <button
          onClick={() => set({ items: [...p.items, { icon: 'heart', value: '0', label: '' }] })}
          className="w-full rounded px-2 py-1 text-xs transition-opacity hover:opacity-80"
          style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          + 항목 추가
        </button>
      ) : null}
    </div>
  );
}
