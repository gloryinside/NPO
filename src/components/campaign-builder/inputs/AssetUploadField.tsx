'use client';
import { useState } from 'react';

interface AssetUploadFieldProps {
  campaignId: string;
  value: string;
  onChange: (url: string) => void;
  label: string;
}

export function AssetUploadField({ campaignId, value, onChange, label }: AssetUploadFieldProps) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/assets`, {
      method: 'POST',
      body: fd,
    });
    setBusy(false);
    if (!res.ok) {
      alert('업로드 실패');
      return;
    }
    const { asset } = await res.json();
    onChange(asset.public_url);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-600">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 max-h-28 w-full rounded object-cover" />
      ) : null}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
        className="w-full text-sm"
      />
      {busy ? <span className="text-xs text-neutral-400">업로드 중…</span> : null}
    </label>
  );
}
