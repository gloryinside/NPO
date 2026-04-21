import DOMPurify from 'isomorphic-dompurify'
import type { RichtextSectionData } from '@/types/landing'

interface Props {
  data: RichtextSectionData
}

// Defense in depth: 관리자만 편집 가능하지만 계정 탈취·다중 관리자 시나리오 대비
// DOMPurify로 sanitize한 HTML만 렌더한다. script·on* 핸들러·javascript: URL 제거.
export function RichtextSection({ data }: Props) {
  const { title, content } = data
  const safeHtml = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button'],
  })

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        {title && (
          <h2 className="text-2xl font-bold mb-8 text-center text-[var(--text)]">{title}</h2>
        )}
        <div
          className="prose prose-neutral max-w-none dark:prose-invert"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify above
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    </section>
  )
}
