'use client';
import { RichTextField } from '../inputs/RichTextField';

export function RichTextPropsForm({ block, onChange }: any) {
  return (
    <RichTextField
      value={block.props.html}
      onChange={(html: string) => onChange({ ...block, props: { html } })}
    />
  );
}
