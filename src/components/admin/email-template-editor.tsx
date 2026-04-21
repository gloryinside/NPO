'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { ScenarioKey, VariableDef } from '@/lib/email/default-templates';

type Props = {
  scenario: ScenarioKey;
  label: string;
  variables: VariableDef[];
  initialSubject: string;
  initialBodyJson: Record<string, unknown>;
};

export function EmailTemplateEditor({ scenario, label, variables, initialSubject, initialBodyJson }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showVarDropdown, setShowVarDropdown] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: initialBodyJson,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[300px] outline-none px-4 py-3 text-[var(--text)]',
      },
    },
  });

  const fetchPreview = useCallback(async (subj: string, json: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/email-templates/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario, subject: subj, bodyJson: json }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html);
      }
    } catch { /* ignore */ }
  }, [scenario]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchPreview(subject, editor.getJSON() as Record<string, unknown>);
      }, 500);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, subject, fetchPreview]);

  useEffect(() => {
    fetchPreview(initialSubject, initialBodyJson);
  }, [fetchPreview, initialSubject, initialBodyJson]);

  useEffect(() => {
    if (!editor) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(subject, editor.getJSON() as Record<string, unknown>);
    }, 500);
  }, [subject, editor, fetchPreview]);

  function insertVariable(varKey: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${varKey}}}`).run();
    setShowVarDropdown(false);
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario,
          subject,
          bodyJson: editor.getJSON(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error ?? '저장 실패' });
        return;
      }
      setMessage({ type: 'success', text: '저장되었습니다.' });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: '저�� 중 오류 발생' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('기본 템플릿으로 초기화하시겠습니까? 커스텀 내용이 사라집니다.')) return;
    if (!editor) return;
    editor.commands.setContent(initialBodyJson);
    setSubject(initialSubject);
    fetchPreview(initialSubject, initialBodyJson);
    setMessage({ type: 'success', text: '기본값으로 초기화되었습니다.' });
  }

  async function handleTestSend() {
    if (!editor) return;
    setMessage(null);
    try {
      const res = await fetch('/api/admin/email-templates/test-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario,
          subject,
          bodyJson: editor.getJSON(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? '발송 실패' });
        return;
      }
      setMessage({ type: 'success', text: `테스트 메일 발송 완료 (${data.sentTo})` });
    } catch {
      setMessage({ type: 'error', text: '발송 중 오류 발생' });
    }
  }

  if (!editor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">{label}</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">이메일 템플릿 편집</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">제목</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              title="이메일 제목"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1.5">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="B" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="I" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="•" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1." />
            <ToolbarButton onClick={() => {
              const url = prompt('링크 URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }} active={editor.isActive('link')} label="🔗" />
            <div className="w-px h-6 bg-[var(--border)] mx-1 self-center" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVarDropdown(!showVarDropdown)}
                className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white font-medium"
              >
                변수 삽입 ▾
              </button>
              {showVarDropdown && (
                <div className="absolute top-full left-0 mt-1 z-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 min-w-[180px]">
                  {variables.map((v) => (
                    <button
                      type="button"
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full text-left px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] flex justify-between"
                    >
                      <span>{v.label}</span>
                      <span className="text-xs text-[var(--muted-foreground)] font-mono">{`{{${v.key}}}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] min-h-[300px]">
            <EditorContent editor={editor} />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={handleReset} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] text-sm">
              기본값으로 초기화
            </button>
            <button type="button" onClick={handleTestSend} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-sm">
              테스트 발송
            </button>
          </div>

          {message && (
            <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-[var(--positive)]/10 text-[var(--positive)]' : 'bg-[var(--negative)]/10 text-[var(--negative)]'}`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">미리보기</label>
          <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              title="이메일 미리보기"
              className="w-full border-0"
              style={{ minHeight: '500px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2 py-1 text-xs rounded font-medium transition-colors',
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--surface)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
