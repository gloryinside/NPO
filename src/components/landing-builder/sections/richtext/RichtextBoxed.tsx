import DOMPurify from 'isomorphic-dompurify'
import type { RichtextBaseData } from '@/lib/landing-variants/richtext-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function RichtextBoxed({ data }: { data: RichtextBaseData }) {
  const { title, content } = data
  const safeHtml = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
  })
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <MotionFadeUp>
          <div
            className="p-8 border-l-4 border-[var(--accent)] bg-[var(--surface-2)]"
            style={{ borderRadius: 'var(--radius-card)' }}
          >
            {title && <h2 className="text-xl font-bold mb-4 text-[var(--text)]">{title}</h2>}
            <div
              className="prose prose-neutral max-w-none dark:prose-invert text-sm"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify sanitized
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        </MotionFadeUp>
      </div>
    </section>
  )
}
