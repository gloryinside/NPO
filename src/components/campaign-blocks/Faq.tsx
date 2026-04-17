'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Faq({ block }: { block: { props: any } }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mx-auto my-12 max-w-3xl px-4">
      {block.props.heading ? (
        <h2 className="mb-6 text-2xl font-bold">{block.props.heading}</h2>
      ) : null}
      <div className="divide-y rounded-lg" style={{ border: '1px solid var(--border)' }}>
        {block.props.items.map((it: any, i: number) => (
          <div key={i} style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-4 text-left font-medium"
              style={{ color: 'var(--text)', background: 'var(--surface)' }}
            >
              {it.question}
              <ChevronDown className={`h-4 w-4 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i ? (
              <div className="px-4 pb-4" style={{ color: 'var(--muted-foreground)', background: 'var(--surface)' }}>{it.answer}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
