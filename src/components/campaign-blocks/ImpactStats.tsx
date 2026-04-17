import { Heart, Users, Globe, Home, Book, Utensils, Droplet, Shield } from 'lucide-react';

const ICONS = { heart: Heart, users: Users, globe: Globe, home: Home, book: Book, utensils: Utensils, droplet: Droplet, shield: Shield } as const;

export function ImpactStats({ block }: { block: { props: any } }) {
  const { heading, items } = block.props;
  return (
    <section className="mx-auto my-12 max-w-5xl px-4">
      {heading ? <h2 className="mb-8 text-center text-3xl font-bold">{heading}</h2> : null}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {items.map((it: any, i: number) => {
          const Icon = (ICONS as any)[it.icon] ?? Heart;
          return (
            <div key={i} className="flex flex-col items-center rounded-lg p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Icon className="mb-3 h-8 w-8" style={{ color: 'var(--accent)' }} />
              <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{it.value}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
