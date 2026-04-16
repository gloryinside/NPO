'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Block, PageContent } from '@/lib/campaign-builder/blocks/schema';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { PropsPanel } from './PropsPanel';

type Viewport = 'desktop' | 'mobile';

export function Editor({
  campaignId,
  campaignSlug,
  initialContent,
  initialFormSettings,
}: {
  campaignId: string;
  campaignSlug: string;
  initialContent: PageContent;
  initialFormSettings: any;
}) {
  const [content, setContent] = useState<PageContent>(initialContent);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Autosave: 2-second debounce on content changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fetch(`/api/admin/campaigns/${campaignId}/page-content`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(content),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, campaignId]);

  const handleAddBlock = useCallback((block: Block) => {
    setContent((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
  }, []);

  const handleBlockChange = useCallback((updated: Block) => {
    setContent((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === updated.id ? updated : b)),
    }));
    setSelectedBlock(updated);
  }, []);

  const handleReorder = useCallback((blocks: Block[]) => {
    setContent((prev) => ({ ...prev, blocks }));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setContent((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
      if (selectedBlock?.id === id) setSelectedBlock(null);
    },
    [selectedBlock],
  );

  const handleDuplicate = useCallback((id: string) => {
    setContent((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev.blocks[idx], id: `${prev.blocks[idx].type}-${Date.now()}` };
      const next = [...prev.blocks];
      next.splice(idx + 1, 0, copy);
      return { ...prev, blocks: next };
    });
  }, []);

  async function handlePreview() {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/preview-token`, {
      method: 'POST',
    });
    if (!res.ok) return alert('미리보기 토큰 생성 실패');
    const { token } = await res.json();
    window.open(`/campaigns/${campaignSlug}/preview?token=${token}`, '_blank');
  }

  async function handlePublish() {
    if (!confirm('게시하면 공개 페이지가 즉시 업데이트됩니다. 계속하시겠습니까?')) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/publish`, { method: 'POST' });
    alert(res.ok ? '게시되었습니다.' : '게시 실패');
  }

  const saveLabel = saveStatus === 'saving' ? '저장 중…' : saveStatus === 'unsaved' ? '미저장' : '저장됨';

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-700">캠페인 편집기</span>
          <span
            className={`text-xs ${saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-neutral-400' : 'text-green-600'}`}
          >
            {saveLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Viewport toggle */}
          <div className="flex rounded border text-xs">
            <button
              className={`px-2 py-1 ${viewport === 'desktop' ? 'bg-neutral-100 font-semibold' : ''}`}
              onClick={() => setViewport('desktop')}
            >
              데스크탑
            </button>
            <button
              className={`px-2 py-1 ${viewport === 'mobile' ? 'bg-neutral-100 font-semibold' : ''}`}
              onClick={() => setViewport('mobile')}
            >
              모바일
            </button>
          </div>
          <button
            onClick={handlePreview}
            className="rounded border px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            미리보기
          </button>
          <button
            onClick={handlePublish}
            className="rounded bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600"
          >
            게시하기
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Palette
          campaignId={campaignId}
          formSettingsInitial={initialFormSettings}
          onAdd={handleAddBlock}
        />

        {/* Canvas area */}
        <main
          className={`flex flex-1 flex-col overflow-auto bg-neutral-100 p-4 ${viewport === 'mobile' ? 'items-center' : ''}`}
        >
          <div className={viewport === 'mobile' ? 'w-[390px]' : 'w-full'}>
            <Canvas
              blocks={content.blocks}
              selectedId={selectedBlock?.id ?? null}
              onSelect={setSelectedBlock}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          </div>
        </main>

        <PropsPanel block={selectedBlock} campaignId={campaignId} onChange={handleBlockChange} />
      </div>
    </div>
  );
}
