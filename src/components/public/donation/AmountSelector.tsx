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
    const raw = e.target.value;
    setCustomInput(raw);
    const num = Number(raw);
    if (raw && !isNaN(num) && num >= 1000) {
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
              key={preset}
              onClick={() => handlePresetClick(preset)}
              style={{
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: 'var(--text)',
                minHeight: '44px',
              }}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-3 px-2 transition-all"
            >
              <span className="text-sm font-bold">{preset.toLocaleString('ko-KR')}원</span>
              {desc && (
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {desc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {allowCustom && (
        <input
          type="number"
          min={1000}
          placeholder="직접 입력"
          value={customInput}
          onChange={handleCustomChange}
          style={{
            border: isCustomActive ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            minHeight: '44px',
            outline: 'none',
          }}
          className="w-full rounded-xl px-4 py-2 text-sm"
        />
      )}
    </div>
  );
}
