'use client';
import { useState } from 'react';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { FormSettingsPanel } from './form-settings/FormSettingsPanel';

type Tab = 'blocks' | 'settings';

type CatalogEntry = {
  type: Block['type'];
  label: string;
  defaults: Block['props'];
};

const CATALOG: CatalogEntry[] = [
  {
    type: 'hero',
    label: 'Hero 배너',
    defaults: { headline: '제목을 입력하세요', ctaLabel: '후원하기' },
  },
  {
    type: 'richText',
    label: '텍스트',
    defaults: { html: '<p>내용을 입력하세요.</p>' },
  },
  {
    type: 'imageSingle',
    label: '이미지',
    defaults: { assetId: '', alt: '' },
  },
  {
    type: 'impactStats',
    label: '임팩트 통계',
    defaults: { items: [{ icon: '', value: '0', label: '항목' }] },
  },
  {
    type: 'fundraisingProgress',
    label: '모금 현황',
    defaults: { showDonorCount: true },
  },
  {
    type: 'faq',
    label: 'FAQ',
    defaults: { items: [{ question: '', answer: '' }] },
  },
  {
    type: 'donationQuickForm',
    label: '퀵 후원 폼',
    defaults: { title: '지금 후원하세요' },
  },
  {
    type: 'snsShare',
    label: 'SNS 공유',
    defaults: { platforms: ['kakao', 'facebook', 'link'] },
  },
];

export function Palette({
  campaignId,
  formSettingsInitial,
  onAdd,
}: {
  campaignId: string;
  formSettingsInitial: any;
  onAdd: (block: Block) => void;
}) {
  const [tab, setTab] = useState<Tab>('blocks');

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-white">
      {/* Tab bar */}
      <div className="flex border-b text-xs font-semibold">
        <button
          type="button"
          className={`flex-1 py-2 ${tab === 'blocks' ? 'border-b-2 border-rose-500 text-rose-600' : 'text-neutral-500'}`}
          onClick={() => setTab('blocks')}
        >
          블록
        </button>
        <button
          type="button"
          className={`flex-1 py-2 ${tab === 'settings' ? 'border-b-2 border-rose-500 text-rose-600' : 'text-neutral-500'}`}
          onClick={() => setTab('settings')}
        >
          폼 설정
        </button>
      </div>

      {/* Block catalog */}
      {tab === 'blocks' && (
        <div className="flex-1 overflow-auto p-2">
          {CATALOG.map(({ type, label, defaults }) => (
            <button
              type="button"
              key={type}
              onClick={() =>
                onAdd({ id: `${type}-${Date.now()}`, type, props: defaults } as Block)
              }
              className="mb-1 flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs hover:bg-neutral-50"
            >
              <span>{label}</span>
              <span className="text-neutral-400">+</span>
            </button>
          ))}
        </div>
      )}

      {/* Form settings */}
      {tab === 'settings' && (
        <div className="flex-1 overflow-auto">
          <FormSettingsPanel campaignId={campaignId} initial={formSettingsInitial} />
        </div>
      )}
    </aside>
  );
}
