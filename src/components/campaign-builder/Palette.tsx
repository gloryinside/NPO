'use client';
import { useState } from 'react';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { FormSettingsPanel } from './form-settings/FormSettingsPanel';

type Tab = 'blocks' | 'settings';

type CatalogEntry = {
  type: Block['type'];
  label: string;
  icon: string;
  defaults: Block['props'];
};

const CATALOG: CatalogEntry[] = [
  { type: 'hero', label: 'Hero 배너', icon: '🖼', defaults: { headline: '제목을 입력하세요', ctaLabel: '후원하기' } },
  { type: 'richText', label: '텍스트', icon: '✏️', defaults: { html: '<p>내용을 입력하세요.</p>' } },
  { type: 'imageSingle', label: '이미지', icon: '📷', defaults: { assetId: '', alt: '' } },
  { type: 'impactStats', label: '임팩트 통계', icon: '📊', defaults: { items: [{ icon: '', value: '0', label: '항목' }] } },
  { type: 'fundraisingProgress', label: '모금 현황', icon: '📈', defaults: { showDonorCount: true } },
  { type: 'faq', label: 'FAQ', icon: '❓', defaults: { items: [{ question: '', answer: '' }] } },
  { type: 'donationQuickForm', label: '퀵 후원 폼', icon: '💜', defaults: { title: '지금 후원하세요' } },
  { type: 'snsShare', label: 'SNS 공유', icon: '🔗', defaults: { platforms: ['kakao', 'facebook', 'link'] } },
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
    <aside className="flex w-52 shrink-0 flex-col border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          className="flex-1 py-2 text-xs font-semibold transition-colors"
          style={{
            borderBottom: tab === 'blocks' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'blocks' ? 'var(--accent)' : 'var(--muted-foreground)',
            background: 'transparent',
          }}
          onClick={() => setTab('blocks')}
        >
          블록
        </button>
        <button
          type="button"
          className="flex-1 py-2 text-xs font-semibold transition-colors"
          style={{
            borderBottom: tab === 'settings' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'settings' ? 'var(--accent)' : 'var(--muted-foreground)',
            background: 'transparent',
          }}
          onClick={() => setTab('settings')}
        >
          폼 설정
        </button>
      </div>

      {/* Block catalog */}
      {tab === 'blocks' && (
        <div className="flex-1 overflow-auto p-2">
          {CATALOG.map(({ type, label, icon, defaults }) => (
            <button
              type="button"
              key={type}
              onClick={() => onAdd({ id: `${type}-${Date.now()}`, type, props: defaults } as Block)}
              className="mb-1 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              <span>{icon}</span>
              <span className="flex-1">{label}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+</span>
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
