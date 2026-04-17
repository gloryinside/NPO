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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevSaveStatus = useRef<'saved' | 'saving' | 'unsaved'>('saved');

  // Fetch preview token on mount for the split-pane iframe
  useEffect(() => {
    fetch(`/api/admin/campaigns/${campaignId}/preview-token`, { method: 'POST' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.token) setPreviewToken(data.token); })
      .catch(() => {});
  }, [campaignId]);

  // Reload iframe when autosave completes
  useEffect(() => {
    if (prevSaveStatus.current === 'saving' && saveStatus === 'saved') {
      setPreviewLoading(true);
      iframeRef.current?.contentWindow?.location.reload();
    }
    prevSaveStatus.current = saveStatus;
  }, [saveStatus]);

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
    const token = previewToken ?? (await fetch(`/api/admin/campaigns/${campaignId}/preview-token`, { method: 'POST' }).then(r => r.json()).then(d => d.token).catch(() => null));
    if (!token) return alert('미리보기 토큰 생성 실패');
    window.open(`/campaigns/${campaignSlug}/preview?token=${token}`, '_blank');
  }

  async function handlePublish() {
    if (!confirm('게시하면 공개 페이지가 즉시 업데이트됩니다. 계속하시겠습니까?')) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/publish`, { method: 'POST' });
    alert(res.ok ? '게시되었습니다.' : '게시 실패');
  }

  const previewSrc = previewToken
    ? `/campaigns/${campaignSlug}/preview?token=${previewToken}`
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <a
            href="/admin/campaigns"
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ← 목록
          </a>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            캠페인 편집기
          </span>
          <span
            className="text-xs"
            style={{
              color: saveStatus === 'unsaved' ? 'var(--warning)' :
                     saveStatus === 'saving' ? 'var(--muted-foreground)' : 'var(--positive)',
            }}
          >
            {saveStatus === 'saving' ? '저장 중…' : saveStatus === 'unsaved' ? '미저장' : '저장됨'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Viewport toggle */}
          <div className="flex rounded border" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewport === 'desktop' ? 'var(--accent)' : 'transparent',
                color: viewport === 'desktop' ? '#fff' : 'var(--muted-foreground)',
                borderRadius: '0.25rem 0 0 0.25rem',
              }}
              title="데스크탑"
            >
              🖥
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewport === 'mobile' ? 'var(--accent)' : 'transparent',
                color: viewport === 'mobile' ? '#fff' : 'var(--muted-foreground)',
                borderRadius: '0 0.25rem 0.25rem 0',
              }}
              title="모바일"
            >
              📱
            </button>
          </div>
          <button
            onClick={handlePreview}
            className="rounded border px-3 py-1 text-xs transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
          >
            새 탭 미리보기
          </button>
          <button
            onClick={handlePublish}
            className="rounded px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            게시하기
          </button>
        </div>
      </header>

      {/* Body: Palette | Canvas (280px) | Preview (flex-1) | PropsPanel (280px) */}
      <div className="flex flex-1 overflow-hidden">
        <Palette
          campaignId={campaignId}
          formSettingsInitial={initialFormSettings}
          onAdd={handleAddBlock}
        />

        {/* Canvas — fixed width */}
        <main className="flex w-[280px] shrink-0 flex-col overflow-auto border-r p-3"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <p className="mb-2 text-center text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            블록 구성
          </p>
          <Canvas
            blocks={content.blocks}
            selectedId={selectedBlock?.id ?? null}
            onSelect={setSelectedBlock}
            onReorder={handleReorder}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </main>

        {/* Preview panel */}
        <div className="flex flex-1 flex-col overflow-hidden border-r"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>미리보기</span>
            {saveStatus === 'saving' && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>업데이트 중…</span>
            )}
          </div>
          <div className="flex flex-1 items-start justify-center overflow-auto p-4">
            {previewSrc ? (
              <div
                className="relative h-full overflow-hidden rounded-lg shadow-lg"
                style={{ width: viewport === 'mobile' ? '390px' : '100%', minHeight: '600px' }}
              >
                {previewLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.05)' }}>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>로딩 중…</span>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={previewSrc}
                  className="h-full w-full border-0"
                  style={{ minHeight: '600px' }}
                  title="캠페인 미리보기"
                  onLoad={() => setPreviewLoading(false)}
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  미리보기를 불러오는 중…
                </span>
              </div>
            )}
          </div>
        </div>

        <PropsPanel block={selectedBlock} campaignId={campaignId} allBlocks={content.blocks} onChange={handleBlockChange} />
      </div>
    </div>
  );
}
