/** 여정 메시지 관리 화면용 조회 — 단계 설정 + 최근 30일 발송 수 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { kstToday } from "@/lib/billing/kst";
import { addDays } from "./dates";
import { effectiveSteps, type EffectiveStep, type JourneyStepRow } from "./steps";

export type JourneyStepView = EffectiveStep & { sent30: number; failed30: number };

export async function loadJourneySteps(supabase: SupabaseClient, orgId: string): Promise<JourneyStepView[]> {
  const since = `${addDays(kstToday(), -30)}T00:00:00+09:00`;
  const [{ data: rows }, { data: sends }] = await Promise.all([
    supabase.from("journey_steps").select("step_key, enabled, channel, subject, body").eq("org_id", orgId),
    supabase.from("journey_sends").select("step_key, status").eq("org_id", orgId).gte("sent_at", since).limit(20000),
  ]);
  const count = new Map<string, { sent: number; failed: number }>();
  for (const s of (sends ?? []) as Array<{ step_key: string; status: string }>) {
    const c = count.get(s.step_key) ?? { sent: 0, failed: 0 };
    if (s.status === "sent") c.sent++;
    else c.failed++;
    count.set(s.step_key, c);
  }
  return effectiveSteps((rows ?? []) as JourneyStepRow[]).map((s) => ({
    ...s,
    sent30: count.get(s.key)?.sent ?? 0,
    failed30: count.get(s.key)?.failed ?? 0,
  }));
}

export type StepUpdate = { enabled: boolean; subject: string; body: string };

/** 저장 값 검증 — 제목 1~120자, 본문 1~3000자 */
export function parseStepUpdate(body: Record<string, unknown>): { ok: true; value: StepUpdate } | { ok: false; error: string } {
  if (typeof body.enabled !== "boolean") return { ok: false, error: "켜기/끄기 값이 없습니다." };
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n").trim() : "";
  if (!subject) return { ok: false, error: "제목을 입력해 주세요." };
  if (subject.length > 120) return { ok: false, error: "제목은 120자까지 쓸 수 있습니다." };
  if (!text) return { ok: false, error: "본문을 입력해 주세요." };
  if (text.length > 3000) return { ok: false, error: "본문은 3,000자까지 쓸 수 있습니다." };
  return { ok: true, value: { enabled: body.enabled, subject, body: text } };
}
