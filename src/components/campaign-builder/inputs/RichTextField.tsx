'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

export function RichTextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className="min-h-24 rounded border p-2 text-sm focus-within:ring-1 focus-within:ring-rose-400">
      <EditorContent editor={editor} />
    </div>
  );
}
