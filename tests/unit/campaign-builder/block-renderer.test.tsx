import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock registry to avoid Next.js server component deps in unit tests
vi.mock('@/lib/campaign-builder/blocks/registry', () => ({
  blockRegistry: {
    richText: ({ block }: any) =>
      React.createElement('p', {}, block.props.html.includes('<script') ? '' : block.props.html),
    hero: ({ block }: any) =>
      React.createElement('h1', {}, block.props.headline),
  },
}));

import { BlockRenderer } from '@/components/campaign-blocks/BlockRenderer';

describe('BlockRenderer', () => {
  it('renders richText block', () => {
    const { container } = render(
      React.createElement(BlockRenderer, {
        content: {
          meta: { schemaVersion: 1 },
          blocks: [{ id: '1', type: 'richText', props: { html: 'hello world' } }],
        } as any,
        slug: 't',
      }),
    );
    expect(container.textContent).toContain('hello world');
  });

  it('skips unknown block type', () => {
    const { container } = render(
      React.createElement(BlockRenderer, {
        content: {
          meta: { schemaVersion: 1 },
          blocks: [{ id: '1', type: 'future', props: {} }],
        } as any,
        slug: 't',
      }),
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing for empty blocks', () => {
    const { container } = render(
      React.createElement(BlockRenderer, {
        content: { meta: { schemaVersion: 1 }, blocks: [] } as any,
        slug: 't',
      }),
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders multiple blocks in order', () => {
    const { container } = render(
      React.createElement(BlockRenderer, {
        content: {
          meta: { schemaVersion: 1 },
          blocks: [
            { id: '1', type: 'hero', props: { headline: 'Title', ctaLabel: 'Go', backgroundImageAssetId: '' } },
            { id: '2', type: 'richText', props: { html: 'Body text' } },
          ],
        } as any,
        slug: 't',
      }),
    );
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Body text');
  });
});
