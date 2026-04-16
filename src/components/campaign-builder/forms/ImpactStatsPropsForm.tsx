'use client';

const ICONS = ['heart', 'users', 'globe', 'home', 'book', 'utensils', 'droplet', 'shield'] as const;

export function ImpactStatsPropsForm({ block, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-600">섹션 제목</span>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          value={p.heading ?? ''}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </label>
      {p.items.map((it: any, i: number) => (
        <div key={i} className="space-y-1 rounded border p-2">
          <select
            className="w-full rounded border px-1 text-sm"
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
            className="w-full rounded border px-1 text-sm"
            placeholder="값 (예: 1,234)"
            value={it.value}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, value: e.target.value }; set({ items }); }}
          />
          <input
            className="w-full rounded border px-1 text-sm"
            placeholder="설명"
            value={it.label}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, label: e.target.value }; set({ items }); }}
          />
          <button
            onClick={() => set({ items: p.items.filter((_: unknown, j: number) => j !== i) })}
            className="text-xs text-rose-500"
          >
            삭제
          </button>
        </div>
      ))}
      {p.items.length < 6 ? (
        <button
          onClick={() => set({ items: [...p.items, { icon: 'heart', value: '0', label: '' }] })}
          className="w-full rounded border px-2 py-1 text-xs hover:bg-neutral-50"
        >
          + 항목 추가
        </button>
      ) : null}
    </div>
  );
}
