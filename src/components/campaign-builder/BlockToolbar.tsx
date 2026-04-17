'use client';
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';

interface BlockToolbarProps {
  dragHandleProps: Record<string, unknown>;
  onUp: () => void;
  onDown: () => void;
  onDup: () => void;
  onDel: () => void;
  canUp: boolean;
  canDown: boolean;
}

export function BlockToolbar({ dragHandleProps, onUp, onDown, onDup, onDel, canUp, canDown }: BlockToolbarProps) {
  return (
    <div className="absolute right-2 top-2 z-20 flex gap-1 rounded px-1 py-0.5 shadow" style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
      <button {...(dragHandleProps as any)} className="cursor-grab p-1" aria-label="드래그">
        <GripVertical className="h-4 w-4" />
      </button>
      <button disabled={!canUp} onClick={onUp} className="p-1 disabled:opacity-30" aria-label="위로">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button disabled={!canDown} onClick={onDown} className="p-1 disabled:opacity-30" aria-label="아래로">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button onClick={onDup} className="p-1" aria-label="복제">
        <Copy className="h-4 w-4" />
      </button>
      <button onClick={onDel} className="p-1" style={{ color: 'var(--negative)' }} aria-label="삭제">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
