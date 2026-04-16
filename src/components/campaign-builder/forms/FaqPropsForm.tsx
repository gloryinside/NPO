'use client';

export function FaqPropsForm({ block, onChange }: any) {
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
          <input
            className="w-full rounded border px-1 text-sm"
            placeholder="질문"
            value={it.question}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, question: e.target.value }; set({ items }); }}
          />
          <textarea
            className="w-full rounded border px-1 text-sm"
            placeholder="답변"
            rows={3}
            value={it.answer}
            onChange={(e) => { const items = [...p.items]; items[i] = { ...it, answer: e.target.value }; set({ items }); }}
          />
          <button
            onClick={() => set({ items: p.items.filter((_: unknown, j: number) => j !== i) })}
            className="text-xs text-rose-500"
          >
            삭제
          </button>
        </div>
      ))}
      {p.items.length < 30 ? (
        <button
          onClick={() => set({ items: [...p.items, { question: '', answer: '' }] })}
          className="w-full rounded border px-2 py-1 text-xs hover:bg-neutral-50"
        >
          + 항목 추가
        </button>
      ) : null}
    </div>
  );
}
