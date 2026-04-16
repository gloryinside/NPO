'use client';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { AssetUploadField } from '../inputs/AssetUploadField';

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-600">{label}</span>
      <input
        className="w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero 배너',
  richText: '텍스트',
  imageSingle: '이미지',
  impactStats: '임팩트 통계',
  fundraisingProgress: '모금 현황',
  faq: 'FAQ',
  donationQuickForm: '퀵 후원 폼',
  snsShare: 'SNS 공유',
};

export function HeroPropsForm({
  block,
  campaignId,
  onChange,
  allBlocks = [],
}: {
  block: Block & { type: 'hero' };
  campaignId: string;
  onChange: (b: Block) => void;
  allBlocks?: Block[];
}) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...block, props: { ...p, ...patch } });

  // Blocks that have an anchor set (usable as scroll targets), excluding the hero itself
  const anchorTargets = allBlocks.filter(
    (b) => b.id !== block.id && b.anchor,
  );

  return (
    <div className="space-y-3">
      <AssetUploadField
        campaignId={campaignId}
        value={p.backgroundImageAssetId ?? ''}
        onChange={(url: string) => set({ backgroundImageAssetId: url })}
        label="배경 이미지"
      />
      <TextInput label="헤드라인" value={p.headline} onChange={(v) => set({ headline: v })} />
      <TextInput label="서브카피" value={p.subheadline ?? ''} onChange={(v) => set({ subheadline: v })} />
      <TextInput label="CTA 버튼 텍스트" value={p.ctaLabel ?? ''} onChange={(v) => set({ ctaLabel: v })} />

      {/* CTA destination: anchor (same-page scroll) OR external URL */}
      <div>
        <span className="mb-1 block text-xs text-neutral-600">CTA 링크 방식</span>
        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!p.ctaAnchorBlockId}
              onChange={() => set({ ctaAnchorBlockId: undefined })}
            />
            외부 URL
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!!p.ctaAnchorBlockId}
              onChange={() => set({ ctaAnchorBlockId: anchorTargets[0]?.anchor ?? '' })}
            />
            같은 페이지 앵커
          </label>
        </div>
      </div>

      {!p.ctaAnchorBlockId ? (
        <TextInput label="CTA URL" value={p.ctaUrl ?? ''} onChange={(v) => set({ ctaUrl: v })} />
      ) : (
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-600">앵커 대상 블록</span>
          {anchorTargets.length === 0 ? (
            <p className="text-xs text-amber-600">
              앵커가 설정된 블록이 없습니다. 대상 블록의 "앵커 ID" 필드를 먼저 입력하세요.
            </p>
          ) : (
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={p.ctaAnchorBlockId}
              onChange={(e) => set({ ctaAnchorBlockId: e.target.value })}
            >
              {anchorTargets.map((b) => (
                <option key={b.id} value={b.anchor}>
                  {BLOCK_TYPE_LABELS[b.type] ?? b.type} — #{b.anchor}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
    </div>
  );
}
