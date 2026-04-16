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
      <div className="divide-y rounded-lg border">
        {block.props.items.map((it: any, i: number) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-4 text-left font-medium"
            >
              {it.question}
              <ChevronDown className={`h-4 w-4 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i ? (
              <div className="px-4 pb-4 text-neutral-700">{it.answer}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
