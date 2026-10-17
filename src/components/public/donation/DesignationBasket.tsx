'use client';

import { useId } from 'react';

export type BasketLine = { key: string; amount: number };

type Option = { key: string; label: string; description?: string };

/**
 * 여러 사업 담기 — 사업을 눌러 담고, 담은 사업마다 금액을 고른다. 합계가 후원 금액이 된다.
 * 금액 버튼은 캠페인 금액 프리셋을 그대로 쓴다.
 */
export default function DesignationBasket({
  options,
  presets,
  allowCustom,
  value,
  onChange,
}: {
  options: Option[];
  presets: number[];
  allowCustom: boolean;
  value: BasketLine[];
  onChange: (next: BasketLine[]) => void;
}) {
  const baseId = useId();
  const total = value.reduce((s, l) => s + l.amount, 0);
  const firstPreset = presets[0] ?? 10000;

  const toggle = (key: string) => {
    const on = value.some((l) => l.key === key);
    onChange(on ? value.filter((l) => l.key !== key) : [...value, { key, amount: firstPreset }]);
  };
  const setAmount = (key: string, amount: number) =>
    onChange(value.map((l) => (l.key === key ? { ...l, amount } : l)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-[var(--text)]">후원할 사업을 담아 주세요 (여러 개 가능)</legend>

      {options.map((o) => {
        const line = value.find((l) => l.key === o.key);
        const on = !!line;
        const customId = `${baseId}-${o.key}`;
        return (
          <div
            key={o.key}
            className={[
              'rounded-xl p-3 transition-[border-color,background-color]',
              on ? 'border-2 border-[var(--accent)] bg-[var(--accent-soft)]' : 'border border-[var(--border)] bg-[var(--surface-2)]',
            ].join(' ')}
          >
            <button
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.key)}
              className="flex w-full min-h-[44px] items-start justify-between gap-3 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{o.description}</span>}
              </span>
              <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)]">
                {on ? '담음 ✓' : '담기'}
              </span>
            </button>

            {line && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`${o.label} 금액`}>
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={line.amount === p}
                    onClick={() => setAmount(o.key, p)}
                    className={[
                      'min-h-[40px] rounded-lg px-3 text-sm tabular-nums text-[var(--text)]',
                      line.amount === p ? 'border-2 border-[var(--accent)] bg-[var(--surface)] font-bold' : 'border border-[var(--border)] bg-[var(--surface)]',
                    ].join(' ')}
                  >
                    {p.toLocaleString('ko-KR')}원
                  </button>
                ))}
                {allowCustom && (
                  <label htmlFor={customId} className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                    <input
                      id={customId}
                      type="text"
                      inputMode="numeric"
                      placeholder="직접 입력"
                      defaultValue={presets.includes(line.amount) ? '' : line.amount.toLocaleString('ko-KR')}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9]/g, ''));
                        if (n >= 1000) setAmount(o.key, n);
                      }}
                      className="w-28 min-h-[40px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-right tabular-nums text-[var(--text)]"
                    />
                    원
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p aria-live="polite" className="flex items-baseline justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text)]">
        <span>{value.length > 0 ? `${value.length}개 사업` : '아직 담은 사업이 없어요'}</span>
        <span className="text-base font-bold tabular-nums">{total.toLocaleString('ko-KR')}원</span>
      </p>
    </fieldset>
  );
}
