import DOMPurify from 'isomorphic-dompurify'
import type { RichtextBaseData } from '@/lib/landing-variants/richtext-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function RichtextPlain({ data }: { data: RichtextBaseData }) {
  const { title, content } = data
  const safeHtml = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
  })
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-8 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <MotionFadeUp>
          <div
            className="prose prose-neutral max-w-none dark:prose-invert"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify sanitized
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </MotionFadeUp>
      </div>
    </section>
  )
}
