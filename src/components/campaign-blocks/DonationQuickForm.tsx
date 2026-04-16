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
    <section id="donate" className="mx-auto my-12 max-w-xl rounded-xl bg-white p-6 shadow-lg">
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
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                donationType === t ? 'bg-rose-500 text-white' : 'bg-neutral-100 hover:bg-neutral-200'
              }`}
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
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              amount === a ? 'border-rose-500 bg-rose-50 font-semibold' : 'hover:bg-neutral-50'
            }`}
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
          className="mb-4 w-full rounded border px-3 py-2 text-sm"
          placeholder="직접 입력"
        />
      ) : null}

      {/* Designation */}
      {block.props.showDesignation && formSettings.designations?.length > 0 ? (
        <select
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          className="mb-4 w-full rounded border px-3 py-2 text-sm"
        >
          {formSettings.designations.map((d: any) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      ) : null}

      <button
        onClick={handleSubmit}
        className="w-full rounded-full bg-rose-500 py-3 font-semibold text-white hover:bg-rose-600 active:scale-95 transition-transform"
      >
        후원하기
      </button>
    </section>
  );
}
