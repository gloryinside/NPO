'use client'
import { useEffect, useState } from 'react'
import type { LandingSection } from '@/types/landing'
import { SECTION_CATALOG } from '@/types/landing'
import { Modal } from '@/components/ui/layer'
import { Button } from '@/components/ui/button'

/**
 * AI 초안 — 기관 소개를 쓰면 템플릿 기반 섹션 문구를 만들어 미리 보여 준다.
 * 저장하지 않는다. "끝에 추가"·"전체 바꾸기"를 눌러야 편집 중 초안에 들어가고, 이후 평소처럼 자동저장·게시.
 *
 * 처음 쓰는 사람 기준: 빈 칸 앞에서 막히지 않게 예시 소개를 눌러 채울 수 있고,
 * 만드는 동안 지금 무엇을 하는지 단계로 보여 준다.
 */
const EXAMPLES = [
  {
    label: '어르신 도시락',
    text: '우리 재단은 2015년부터 지역 독거 어르신께 매일 도시락을 전달합니다. 올겨울에는 난방비 지원 캠페인을 열고 정기후원자를 모집합니다.',
  },
  {
    label: '아동 학습 지원',
    text: '저소득 가정 초등학생에게 방과후 학습과 간식을 지원하는 지역아동센터입니다. 새 학기 학용품 지원 모금을 시작합니다.',
  },
  {
    label: '유기동물 보호',
    text: '구조된 유기동물을 치료하고 입양을 돕는 보호소입니다. 수술비와 사료비를 위한 정기후원을 모집합니다.',
  },
]

const STAGES = ['기관 소개를 읽는 중…', '어울리는 섹션을 고르는 중…', '문구를 쓰는 중…', '내용을 점검하는 중…']

export function LandingAiPanel({
  onApply,
  onClose,
}: {
  onApply: (sections: LandingSection[], mode: 'append' | 'replace') => void
  onClose: () => void
}) {
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sections: LandingSection[]; dropped: number } | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  // 응답을 기다리는 동안 단계 문구를 넘긴다(실제 진행률이 아니라 "멈춘 게 아니다"라는 신호)
  useEffect(() => {
    if (!busy) return
    setStage(0)
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2500)
    return () => clearInterval(t)
  }, [busy])

  async function generate() {
    setBusy(true)
    setError(null)
    setResult(null)
    setConfirmReplace(false)
    try {
      const res = await fetch('/api/admin/org/landing/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 사용자가 다음에 무엇을 하면 되는지로 바꿔 말한다
        if (res.status === 503) throw new Error('AI 기능이 아직 켜져 있지 않습니다. 템플릿에서 섹션을 골라 시작해 주세요.')
        if (res.status === 429) throw new Error('잠시 후 다시 시도해 주세요. AI 초안은 한 시간에 10번까지 만들 수 있어요.')
        throw new Error(json.message ?? json.error ?? '초안을 만들지 못했습니다. 소개를 조금 바꿔 다시 시도해 주세요.')
      }
      setResult(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = (s: LandingSection) => SECTION_CATALOG.find((c) => c.type === s.type)?.label ?? s.type
  const text = (s: LandingSection) => {
    const d = s.data as Record<string, unknown>
    return {
      head: String(d.headline ?? d.title ?? ''),
      body: String(d.subheadline ?? d.body ?? d.subtitle ?? ''),
    }
  }

  const footer = !result ? (
    <>
      <Button variant="outline" onClick={onClose}>
        닫기
      </Button>
      <Button onClick={generate} loading={busy} disabled={brief.trim().length < 10}>
        {busy ? '만드는 중…' : '초안 만들기'}
      </Button>
    </>
  ) : result.sections.length > 0 ? (
    <>
      <Button variant="ghost" onClick={() => setResult(null)}>
        소개 고쳐서 다시 만들기
      </Button>
      {confirmReplace ? (
        <Button variant="destructive" onClick={() => onApply(result.sections, 'replace')}>
          지금 섹션을 모두 지우고 바꾸기
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setConfirmReplace(true)}>
          전체 바꾸기
        </Button>
      )}
      <Button onClick={() => onApply(result.sections, 'append')}>페이지 끝에 추가</Button>
    </>
  ) : (
    <Button variant="outline" onClick={() => setResult(null)}>
      다시 만들기
    </Button>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="AI로 홈페이지 초안 만들기"
      description="기관을 몇 문장으로 소개하면 첫 화면·후원 안내·자주 묻는 질문 문구를 제안해요. 숫자는 지어내지 않고, 사진과 링크는 그대로 둡니다. 저장은 버튼을 눌러야 됩니다."
      footer={footer}
    >
      {!result ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">예시로 시작하기</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setBrief(ex.text)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
              우리 기관 소개 (누구를, 무엇으로 돕는지 · 이번에 모금하는 이유)
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={1500}
              rows={6}
              disabled={busy}
              placeholder="예: 우리 단체는 지역 독거 어르신께 도시락을 전달합니다. 올겨울 난방비 지원 캠페인을 열고…"
              className="w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]"
            />
          </label>
          <div className="flex justify-between text-[11px] text-[var(--muted-2)]">
            <span>{brief.trim().length < 10 ? '10자 이상 적어 주세요.' : ' '}</span>
            <span>{brief.length}/1500</span>
          </div>
          {busy && (
            <p role="status" className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]">
              {STAGES[stage]}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-sm text-[var(--negative)]">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text)]">
            {result.sections.length > 0
              ? `섹션 ${result.sections.length}개를 제안했어요. 문구를 확인하고 추가하세요. 추가한 뒤에도 하나씩 고칠 수 있어요.`
              : '쓸 수 있는 제안이 없었어요. 소개를 조금 더 구체적으로 적어 다시 만들어 보세요.'}
            {result.dropped > 0 && ` (점검에서 ${result.dropped}개는 뺐어요)`}
          </p>
          <ol className="space-y-2">
            {result.sections.map((s, i) => {
              const t = text(s)
              return (
                <li key={s.id} className="rounded-xl border border-[var(--border)] px-3.5 py-3">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {i + 1}. {label(s)}
                  </p>
                  {t.head && <p className="mt-1 font-semibold text-[var(--text)]">{t.head}</p>}
                  {t.body && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{t.body}</p>}
                </li>
              )
            })}
          </ol>
          {confirmReplace && (
            <p role="alert" className="text-xs text-[var(--negative)]">
              지금 편집 중인 섹션이 모두 지워지고 제안으로 바뀝니다. 게시한 페이지는 다시 게시하기 전까지 그대로예요.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
