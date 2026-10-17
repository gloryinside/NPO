/**
 * POST /api/admin/assist  body: { question: string }
 * 직원의 "어떻게 해요?" 질문에 쉬운 말 답 + 단계 + 화면 링크(메뉴 목록 안에서만).
 * AI 키가 없으면 503 — 화면은 메뉴 검색 결과로 대신 안내한다. 사용자당 시간당 30회.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { rateLimit } from '@/lib/rate-limit'
import { landingAiEnabled } from '@/lib/landing/ai'
import { ASSIST_MODEL, ASSIST_SYSTEM, assistOutputSchema, describeScreensForPrompt, resolveLinks } from '@/lib/admin/assist'

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { user } = guard.ctx

  if (!landingAiEnabled()) {
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => null)) as { question?: unknown } | null
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 300) : ''
  if (question.length < 4) {
    return NextResponse.json({ error: '질문을 조금 더 자세히 적어 주세요.' }, { status: 400 })
  }

  const rl = rateLimit(`admin-assist:${user.id}`, 30, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: '잠시 후 다시 물어봐 주세요. 한 시간에 30번까지 물어볼 수 있어요.' }, { status: 429 })
  }

  try {
    const { output } = await generateText({
      model: ASSIST_MODEL,
      system: ASSIST_SYSTEM,
      output: Output.object({ schema: assistOutputSchema() }),
      prompt: `시스템의 화면 목록(주소 | 위치 > 이름: 하는 일):\n${describeScreensForPrompt()}\n\n<직원 질문>\n${question}\n</직원 질문>`,
    })
    return NextResponse.json({ answer: output.answer, steps: output.steps, links: resolveLinks(output.links) })
  } catch (err) {
    console.error('[admin/assist] 실패', err)
    return NextResponse.json({ error: '답을 만들지 못했습니다. 메뉴 검색 결과를 확인하거나 잠시 후 다시 물어봐 주세요.' }, { status: 502 })
  }
}
