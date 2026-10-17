'use client';

import { useEffect, useState } from 'react';
import type { PublicChild } from '@/lib/sponsorship/pick';

/**
 * 결연 아동 선택 — 정기후원 신청에서 결연할 아이를 고른다. 고르지 않으면 기관이 맺어 준다.
 */
export default function ChildPicker({
  campaignSlug,
  value,
  onChange,
}: {
  campaignSlug: string;
  value: string | undefined;
  onChange: (child: PublicChild | null) => void;
}) {
  const [children, setChildren] = useState<PublicChild[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/campaigns/${encodeURIComponent(campaignSlug)}/children`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { children?: PublicChild[] }) => alive && setChildren(d.children ?? []))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [campaignSlug]);

  if (failed) {
    return <p className="text-sm text-[var(--muted-foreground)]">아이 목록을 불러오지 못했어요. 고르지 않고 신청하면 기관이 결연을 맺어 드려요.</p>;
  }
  if (children === null) {
    return <p className="text-sm text-[var(--muted-foreground)]">결연을 기다리는 아이들을 불러오는 중…</p>;
  }
  if (children.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">지금 고를 수 있는 아이가 없어요. 신청하시면 기관이 결연을 맺어 드려요.</p>;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-[var(--text)]">결연할 아이를 골라 주세요 (선택)</legend>
      <p className="text-xs text-[var(--muted-foreground)]">아이의 개인정보를 지키려고 이름은 성만 보여 드려요. 결연이 시작되면 마이페이지에서 소식과 편지를 주고받을 수 있어요.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {children.map((c) => {
          const on = value === c.id;
          const facts = [c.age !== null ? `${c.age}세` : null, c.gender, c.region].filter(Boolean).join(', ');
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : c)}
              className={[
                'flex min-h-[44px] gap-3 rounded-xl p-3 text-left',
                on ? 'border-2 border-[var(--accent)] bg-[var(--accent-soft)]' : 'border border-[var(--border)] bg-[var(--surface-2)]',
              ].join(' ')}
            >
              {c.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- 기관이 넣은 외부 주소라 next/image 도메인 설정 밖
                <img src={c.photoUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {c.displayName} <span className="font-normal text-[var(--muted-foreground)]">({c.code})</span>
                </span>
                {facts && <span className="block text-xs text-[var(--muted-foreground)]">{facts}</span>}
                {c.bio && <span className="mt-1 line-clamp-2 block text-xs text-[var(--text)]">{c.bio}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
