'use client';
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

export function HeroPropsForm({ block, campaignId, onChange }: any) {
  const p = block.props;
  const set = (patch: Record<string, unknown>) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-3">
      <AssetUploadField
        campaignId={campaignId}
        value={p.backgroundImageAssetId}
        onChange={(url: string) => set({ backgroundImageAssetId: url })}
        label="배경 이미지"
      />
      <TextInput label="헤드라인" value={p.headline} onChange={(v) => set({ headline: v })} />
      <TextInput label="서브카피" value={p.subheadline ?? ''} onChange={(v) => set({ subheadline: v })} />
      <TextInput label="CTA 버튼 텍스트" value={p.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
      <TextInput label="CTA 앵커 블록 ID" value={p.ctaAnchorBlockId ?? ''} onChange={(v) => set({ ctaAnchorBlockId: v })} />
    </div>
  );
}
