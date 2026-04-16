import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';

/**
 * Renders rich text HTML from block props.
 * All HTML passes through DOMPurify (via sanitizeHtml) before rendering —
 * raw user input never reaches the DOM.
 */
export function RichText({ block }: { block: { props: { html: string } } }) {
  const sanitized = sanitizeHtml(block.props.html);
  return (
    <div
      className="prose prose-neutral mx-auto max-w-3xl px-4 py-8"
      // sanitized is the result of DOMPurify.sanitize() — safe for rendering
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
