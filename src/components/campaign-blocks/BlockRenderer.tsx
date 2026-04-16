import { blockRegistry } from '@/lib/campaign-builder/blocks/registry';
import type { PageContent } from '@/lib/campaign-builder/blocks/schema';

export function BlockRenderer({ content, slug }: { content: PageContent; slug: string }) {
  if (!content?.blocks) return null;
  return (
    <>
      {content.blocks.map((b) => {
        const Comp = blockRegistry[b.type];
        if (!Comp) return null;
        return <Comp key={b.id} block={b as any} slug={slug} />;
      })}
    </>
  );
}
