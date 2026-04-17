'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DonationQuickForm({
  block,
  slug,
  formSettings,
}: {
  block: any;
  slug: string;
  formSettings: any;
}) {
  const router = useRouter();
  const [donationType, setDonationType] = useState<string>(
    formSettings.donationTypes?.[0] ?? 'onetime',
  );
  const [amount, setAmount] = useState<number>(
    formSettings.amountPresets?.[0] ?? 10000,
  );
  const [designation, setDesignation] = useState<string | undefined>(
    formSettings.designations?.[0]?.key,
  );

  function handleSubmit() {
    const params = new URLSearchParams({
      campaign: slug,
      type: donationType,
      amount: String(amount),
    });
    if (designation) params.set('designation', designation);
    router.push(`/donate/wizard?${params.toString()}`);
  }

  return (
    <section
      id="donate"
      className="mx-auto my-12 max-w-xl rounded-xl p-6 shadow-lg"
      style={{ background: 'var(--surface)', color: 'var(--text)' }}
    >
      {block.props.heading ? (
        <h2 className="mb-4 text-2xl font-bold">{block.props.heading}</h2>
      ) : null}

      {/* Donation type toggle */}
      {formSettings.donationTypes?.length > 1 ? (
        <div className="mb-4 flex gap-2">
          {formSettings.donationTypes.map((t: string) => (
            <button
              key={t}
              onClick={() => setDonationType(t)}
              className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={donationType === t
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t === 'regular' ? '정기후원' : '일시후원'}
            </button>
          ))}
        </div>
      ) : null}

      {/* Amount presets */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {formSettings.amountPresets?.map((a: number) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className="rounded-lg px-3 py-2 text-sm transition-colors"
            style={amount === a
              ? { border: '2px solid var(--accent)', background: 'var(--accent-soft)', fontWeight: 600, color: 'var(--accent)' }
              : { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          >
            {a.toLocaleString('ko-KR')}원
          </button>
        ))}
      </div>

      {/* Custom amount */}
      {formSettings.allowCustomAmount ? (
        <input
          type="number"
          value={amount}
          min={1000}
          step={1000}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mb-4 w-full rounded px-3 py-2 text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          placeholder="직접 입력"
        />
      ) : null}

      {/* Designation */}
      {block.props.showDesignation && formSettings.designations?.length > 0 ? (
        <select
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          className="mb-4 w-full rounded px-3 py-2 text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        >
          {formSettings.designations.map((d: any) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      ) : null}

      <button
        onClick={handleSubmit}
        className="w-full rounded-full py-3 font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
        style={{ background: 'var(--accent)' }}
      >
        후원하기
      </button>
    </section>
  );
}
