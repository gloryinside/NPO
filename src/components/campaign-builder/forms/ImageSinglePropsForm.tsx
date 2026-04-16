'use client';
import { AssetUploadField } from '../inputs/AssetUploadField';

export function ImageSinglePropsForm({ block, campaignId, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-3">
      <AssetUploadField
        campaignId={campaignId}
        value={p.assetId}
        onChange={(url: string) => set({ assetId: url })}
        label="이미지"
      />
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-600">Alt 텍스트</span>
        <input className="w-full rounded border px-2 py-1 text-sm" value={p.altText ?? ''} onChange={(e) => set({ altText: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-600">캡션</span>
        <input className="w-full rounded border px-2 py-1 text-sm" value={p.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-600">링크 URL</span>
        <input className="w-full rounded border px-2 py-1 text-sm" value={p.linkUrl ?? ''} onChange={(e) => set({ linkUrl: e.target.value })} />
      </label>
    </div>
  );
}
