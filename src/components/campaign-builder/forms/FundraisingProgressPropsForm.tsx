'use client';

export function FundraisingProgressPropsForm({ block, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.showDonorCount}
          onChange={(e) => set({ showDonorCount: e.target.checked })}
        />
        후원자 수 표시
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.showDDay}
          onChange={(e) => set({ showDDay: e.target.checked })}
        />
        D-Day 표시
      </label>
    </div>
  );
}
