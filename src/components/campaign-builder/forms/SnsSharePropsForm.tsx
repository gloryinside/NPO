'use client';

const CHANNELS = [
  { id: 'kakao', label: '카카오톡' },
  { id: 'facebook', label: '페이스북' },
  { id: 'link', label: '링크 복사' },
] as const;

export function SnsSharePropsForm({ block, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });
  const toggle = (c: string) =>
    p.channels.includes(c)
      ? p.channels.filter((x: string) => x !== c)
      : [...p.channels, c];

  return (
    <div className="space-y-2">
      {CHANNELS.map(({ id, label }) => (
        <label key={id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.channels.includes(id)}
            onChange={() => set({ channels: toggle(id) })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
