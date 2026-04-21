import type { RichtextSectionData } from '@/types/landing'

interface Props {
  data: RichtextSectionData
}

// content는 관리자(신뢰된 사용자)만 편집 가능한 HTML입니다.
// 외부 사용자 입력이 절대 이 필드에 도달하지 않도록 API에서 관리자 인증을 강제합니다.
/* eslint-disable-next-line */
export function RichtextSection({ data }: Props) {
  const { title, content } = data

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        {title && (
          <h2 className="text-2xl font-bold mb-8 text-center text-[var(--text)]">{title}</h2>
        )}
        <div
          className="prose prose-neutral max-w-none dark:prose-invert"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-only content
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  )
}
