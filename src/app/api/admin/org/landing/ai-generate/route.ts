/**
 * POST /api/admin/org/landing/ai-generate  body: { brief: string }
 *
 * 기관 소개(brief)로 랜딩 초안 섹션을 만든다 — 저장하지 않고 미리보기용 섹션만 돌려준다.
 * 규칙·안전장치는 lib/landing/ai.ts. 키가 없으면 503(기능 꺼짐), 기관당 시간당 10회.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { kstToday } from '@/lib/billing/kst'
import { sectionTemplates } from '@/lib/landing/templates'
import {
  aiOutputSchema,
  buildAiSections,
  describeTemplatesForPrompt,
  LANDING_AI_MODEL,
  LANDING_AI_SYSTEM,
  landingAiEnabled,
} from '@/lib/landing/ai'

const HOURLY_LIMIT = 10

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant, user } = guard.ctx

  if (!landingAiEnabled()) {
    return NextResponse.json(
      { error: 'ai_not_configured', message: 'AI 초안 기능이 설정되지 않았습니다(AI_GATEWAY_API_KEY).' },
      { status: 503 },
    )
  }

  let body: { brief?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, 1500) : ''
  if (brief.length < 10) {
    return NextResponse.json({ error: '기관 소개를 10자 이상 적어 주세요.' }, { status: 400 })
  }

  // 비용 보호 — 감사 로그로 센다(메모리 한도는 서버 인스턴스마다 초기화되므로)
  const supabase = createSupabaseAdminClient()
  const { count } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', tenant.id)
    .eq('action', 'landing.ai_generate')
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
  if ((count ?? 0) >= HOURLY_LIMIT) {
    return NextResponse.json({ error: '한 시간에 10번까지 만들 수 있어요. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }

  const today = kstToday()
  const ids = sectionTemplates(today).map((t) => t.id) as [string, ...string[]]

  let output
  try {
    const result = await generateText({
      model: LANDING_AI_MODEL,
      system: LANDING_AI_SYSTEM,
      output: Output.object({ schema: aiOutputSchema(ids) }),
      prompt: `기관 이름: ${tenant.name}\n\n<기관 소개>\n${brief}\n</기관 소개>\n\n사용할 수 있는 템플릿:\n${describeTemplatesForPrompt(today)}\n\n후원 랜딩페이지 섹션을 3~6개 골라 순서대로 문구를 써 주세요.`,
    })
    output = result.output
  } catch (err) {
    console.error('[landing/ai-generate] 생성 실패', err)
    return NextResponse.json({ error: 'AI 초안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
  }

  const { sections, dropped } = buildAiSections(output, today)

  void logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'landing.ai_generate',
    resourceType: 'org',
    resourceId: tenant.id,
    summary: `AI 랜딩 초안 ${sections.length}개 섹션(제외 ${dropped})`,
    metadata: { model: LANDING_AI_MODEL },
  })

  return NextResponse.json({ sections, dropped })
}
