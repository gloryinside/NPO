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
  onChange,
}: {
  block: Block | null;
  campaignId: string;
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
      <div className="p-4">
        {Form ? (
          <Form block={block} campaignId={campaignId} onChange={onChange} />
        ) : (
          <p className="text-sm text-neutral-400">편집 불가</p>
        )}
      </div>
    </aside>
  );
}
