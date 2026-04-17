'use client';

import { Link } from 'lucide-react';

export function SnsShare({ block }: { block: { props: any } }) {
  const channels: string[] = block.props.channels ?? [];

  function copyLink() {
    navigator.clipboard.writeText(location.href).catch(() => {});
  }

  return (
    <section className="my-8 flex flex-wrap justify-center gap-3">
      {channels.includes('facebook') ? (
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            typeof window !== 'undefined' ? location.href : '',
          )}`}
          className="inline-flex items-center gap-2 rounded-full bg-[#1877F2] px-5 py-2 text-sm text-white hover:opacity-90"
        >
          페이스북 공유
        </a>
      ) : null}
      {channels.includes('kakao') ? (
        <button
          onClick={() => (window as any).Kakao?.Share?.sendDefault?.({ objectType: 'feed' })}
          className="rounded-full bg-[#FEE500] px-5 py-2 text-sm font-medium text-[#3C1E1E] hover:opacity-90"
        >
          카카오톡 공유
        </button>
      ) : null}
      {channels.includes('link') ? (
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <Link className="h-4 w-4" />
          링크 복사
        </button>
      ) : null}
    </section>
  );
}
