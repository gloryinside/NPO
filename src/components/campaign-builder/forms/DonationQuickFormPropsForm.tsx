'use client';

export function DonationQuickFormPropsForm({ block, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-600">제목</span>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          value={p.heading ?? ''}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.showDesignation}
          onChange={(e) => set({ showDesignation: e.target.checked })}
        />
        후원 목적 선택 표시
      </label>
    </div>
  );
}
