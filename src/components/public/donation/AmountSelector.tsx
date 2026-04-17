'use client';

import { useState } from 'react';

interface AmountSelectorProps {
  presets: number[];
  amountDescriptions?: Record<string, string>;
  allowCustom: boolean;
  value: number | null;
  onChange: (amount: number | null) => void;
}

export default function AmountSelector({
  presets,
  amountDescriptions,
  allowCustom,
  value,
  onChange,
}: AmountSelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const isPresetSelected = value !== null && presets.includes(value);
  const isCustomActive = value !== null && !isPresetSelected;

  const handlePresetClick = (preset: number) => {
    setCustomInput('');
    onChange(preset);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(digits);
    const formatted = digits ? num.toLocaleString('ko-KR') : '';
    setCustomInput(formatted);
    if (digits && num >= 1000) {
      onChange(num);
    } else {
      onChange(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {presets.map((preset) => {
          const selected = value === preset;
          const desc = amountDescriptions?.[String(preset)];
          return (
            <button
              type="button"
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className={[
                'flex flex-col items-center justify-center gap-0.5 rounded-xl py-3 px-2 min-h-[44px] transition-all text-[var(--text)]',
                selected
                  ? 'border-2 border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border border-[var(--border)] bg-[var(--surface-2)]',
              ].join(' ')}
            >
              <span className="text-sm font-bold">{preset.toLocaleString('ko-KR')}원</span>
              {desc && (
                <span className="text-xs text-[var(--muted-foreground)]">{desc}</span>
              )}
            </button>
          );
        })}
      </div>

      {allowCustom && (
        <input
          type="text"
          inputMode="numeric"
          placeholder="직접 입력 (원)"
          value={customInput}
          onChange={handleCustomChange}
          className={[
            'w-full rounded-xl px-4 py-2 text-sm min-h-[44px] outline-none bg-[var(--surface-2)] text-[var(--text)]',
            isCustomActive
              ? 'border-2 border-[var(--accent)]'
              : 'border border-[var(--border)]',
          ].join(' ')}
        />
      )}
    </div>
  );
}

export { AmountSelector };
