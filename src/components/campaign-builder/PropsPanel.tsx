'use client';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { HeroPropsForm } from './forms/HeroPropsForm';
import { RichTextPropsForm } from './forms/RichTextPropsForm';
import { ImageSinglePropsForm } from './forms/ImageSinglePropsForm';
import { ImpactStatsPropsForm } from './forms/ImpactStatsPropsForm';
import { FundraisingProgressPropsForm } from './forms/FundraisingProgressPropsForm';
import { FaqPropsForm } from './forms/FaqPropsForm';
import { DonationQuickFormPropsForm } from './forms/DonationQuickFormPropsForm';
import { SnsSharePropsForm } from './forms/SnsSharePropsForm';

const FORM_MAP: Record<string, React.ComponentType<any>> = {
  hero: HeroPropsForm,
  richText: RichTextPropsForm,
  imageSingle: ImageSinglePropsForm,
  impactStats: ImpactStatsPropsForm,
  fundraisingProgress: FundraisingProgressPropsForm,
  faq: FaqPropsForm,
  donationQuickForm: DonationQuickFormPropsForm,
  snsShare: SnsSharePropsForm,
};

const BLOCK_LABELS: Record<string, string> = {
  hero: 'Hero 배너',
  richText: '텍스트',
  imageSingle: '이미지',
  impactStats: '임팩트 통계',
  fundraisingProgress: '모금 현황',
  faq: 'FAQ',
  donationQuickForm: '퀵 후원 폼',
  snsShare: 'SNS 공유',
};

export function PropsPanel({
  block,
  campaignId,
  allBlocks,
  onChange,
}: {
  block: Block | null;
  campaignId: string;
  allBlocks: Block[];
  onChange: (b: Block) => void;
}) {
  if (!block) {
    return (
      <aside className="w-80 shrink-0 border-l bg-white p-4 text-sm text-neutral-500">
        왼쪽 캔버스에서 블록을 클릭하세요
      </aside>
    );
  }

  const Form = FORM_MAP[block.type];

  return (
    <aside className="w-80 shrink-0 overflow-auto border-l bg-white">
      <div className="border-b px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-neutral-500">
          {BLOCK_LABELS[block.type] ?? block.type}
        </div>
      </div>
      <div className="space-y-4 p-4">
        {Form ? (
          <Form block={block} campaignId={campaignId} allBlocks={allBlocks} onChange={onChange} />
        ) : (
          <p className="text-sm text-neutral-400">편집 불가</p>
        )}

        {/* Common fields: anchor ID + hiddenOn — available on every block */}
        <div className="border-t pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            공통 설정
          </div>

          {/* Anchor ID */}
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-neutral-600">앵커 ID (선택)</span>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="예: donation-form"
              value={block.anchor ?? ''}
              onChange={(e) =>
                onChange({ ...block, anchor: e.target.value || undefined })
              }
            />
            <span className="mt-0.5 block text-[10px] text-neutral-400">
              다른 블록의 CTA가 이 블록으로 스크롤할 때 사용됩니다.
            </span>
          </label>

          {/* hiddenOn */}
          <div>
            <span className="mb-1 block text-xs text-neutral-600">숨기기</span>
            <div className="flex gap-3 text-xs">
              {(['mobile', 'desktop', undefined] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`hiddenOn-${block.id}`}
                    checked={block.hiddenOn === val}
                    onChange={() =>
                      onChange({ ...block, hiddenOn: val })
                    }
                  />
                  {val === undefined ? '항상 표시' : val === 'mobile' ? '모바일 숨김' : '데스크탑 숨김'}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
