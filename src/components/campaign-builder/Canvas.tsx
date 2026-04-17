'use client';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { BlockToolbar } from './BlockToolbar';

const BLOCK_ICONS: Record<string, string> = {
  hero: '🖼',
  richText: '✏️',
  imageSingle: '🖼',
  impactStats: '📊',
  fundraisingProgress: '📈',
  faq: '❓',
  donationQuickForm: '💜',
  snsShare: '🔗',
};

// Client-side preview for each block type — plain text/icon stubs
// (full server components can't be used inside the editor canvas)
const PREVIEW_LABELS: Record<string, string> = {
  hero: 'Hero 배너',
  richText: '텍스트 블록',
  imageSingle: '이미지',
  impactStats: '임팩트 통계',
  fundraisingProgress: '모금 현황',
  faq: 'FAQ',
  donationQuickForm: '퀵 후원 폼',
  snsShare: 'SNS 공유',
};

export function Canvas({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (b: Block) => void;
  onReorder: (b: Block[]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    onReorder(arrayMove(blocks, from, to));
  }

  const moveBy = (id: string, delta: number) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    onReorder(arrayMove(blocks, i, j));
  };

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-12 text-center"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
        <span className="text-2xl">＋</span>
        <p className="text-xs">왼쪽에서 블록을 추가하세요</p>
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        {blocks.map((b, idx) => (
          <SortableBlock
            key={b.id}
            block={b}
            idx={idx}
            total={blocks.length}
            selected={selectedId === b.id}
            onSelect={() => onSelect(b)}
            onRemove={() => onDelete(b.id)}
            onDuplicate={() => onDuplicate(b.id)}
            onUp={() => moveBy(b.id, -1)}
            onDown={() => moveBy(b.id, 1)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableBlock({
  block,
  idx,
  total,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  onUp,
  onDown,
}: {
  block: Block;
  idx: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
      }}
      onClick={onSelect}
      className={`group relative mb-1 cursor-pointer rounded-lg border transition-all ${
        selected
          ? 'border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]'
          : 'border-[var(--border)] hover:border-[var(--accent)]'
      }`}
    >
      <BlockToolbar
        dragHandleProps={{ ...attributes, ...listeners }}
        canUp={idx > 0}
        canDown={idx < total - 1}
        onUp={onUp}
        onDown={onDown}
        onDup={onDuplicate}
        onDel={onRemove}
      />
      <div
        className="px-3 py-3 text-xs font-medium"
        style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}
      >
        {BLOCK_ICONS[block.type] ?? '▪'}{' '}
        {PREVIEW_LABELS[block.type] ?? block.type}
      </div>
    </div>
  );
}
