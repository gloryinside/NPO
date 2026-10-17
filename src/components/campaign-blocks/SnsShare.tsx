'use client';

import { useEffect, useState } from 'react';
import { Link } from 'lucide-react';
import { facebookShareUrl, shareTo, type ShareChannel, type ShareOutcome } from '@/lib/share';

const MESSAGES: Record<ShareChannel, Partial<Record<ShareOutcome, string>>> = {
  kakao: { copied: '링크를 복사했어요. 카카오톡 대화방에 붙여 넣어 주세요.' },
  facebook: {},
  link: { copied: '링크를 복사했어요.' },
};

export function SnsShare({ block }: { block: { props: any } }) {
  const channels: string[] = block.props.channels ?? [];
  const [status, setStatus] = useState('');
  // 서버 렌더에는 location이 없다 — 브라우저에서 주소를 채워 hydration 불일치를 피한다
  const [fbHref, setFbHref] = useState('');
  useEffect(() => setFbHref(facebookShareUrl(location.href)), []);

  async function share(channel: ShareChannel) {
    const outcome = await shareTo(channel, { url: location.href, title: document.title });
    setStatus(
      outcome === 'failed'
        ? '공유하지 못했어요. 주소창의 링크를 직접 복사해 주세요.'
        : (MESSAGES[channel][outcome] ?? ''),
    );
  }

  return (
    <section className="my-8 flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-3">
        {channels.includes('facebook') ? (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={fbHref || undefined}
            className="inline-flex items-center gap-2 rounded-full bg-[#1877F2] px-5 py-2 text-sm text-white hover:opacity-90"
          >
            페이스북 공유
          </a>
        ) : null}
        {channels.includes('kakao') ? (
          <button
            type="button"
            onClick={() => share('kakao')}
            className="rounded-full bg-[#FEE500] px-5 py-2 text-sm font-medium text-[#3C1E1E] hover:opacity-90"
          >
            카카오톡 공유
          </button>
        ) : null}
        {channels.includes('link') ? (
          <button
            type="button"
            onClick={() => share('link')}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <Link className="h-4 w-4" />
            링크 복사
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-xs text-[var(--muted-foreground)]">
        {status}
      </p>
    </section>
  );
}
