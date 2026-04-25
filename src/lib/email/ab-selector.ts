import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AB 테스트 variant 선택기.
 *
 * 같은 (org, scenario, lang) 의 활성 템플릿 중:
 *   - variant=null 만 있으면 → 그 행 반환
 *   - variant 가 여럿 있으면 → ab_weight 비율로 가중 랜덤 선택
 *
 * 결정적 분배가 필요하면 recipientEmail의 hash를 사용 (같은 사용자는 항상 같은 variant 받음).
 */
export interface SelectedTemplate {
  id: string;
  subject: string;
  body_json: Record<string, unknown>;
  variant: string | null;
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export async function selectTemplate(
  supabase: SupabaseClient,
  orgId: string,
  scenario: string,
  lang: string = "ko",
  recipientEmail?: string,
): Promise<SelectedTemplate | null> {
  const { data: rows } = await supabase
    .from("email_templates")
    .select("id, subject, body_json, variant, ab_weight")
    .eq("org_id", orgId)
    .eq("scenario", scenario)
    .eq("lang", lang)
    .eq("is_active", true);

  if (!rows?.length) {
    // lang fallback to 'ko'
    if (lang !== "ko") {
      return selectTemplate(supabase, orgId, scenario, "ko", recipientEmail);
    }
    return null;
  }

  // 단일 (variant null)이거나 모두 변형 — 분기 처리
  const variants = rows as Array<{
    id: string; subject: string; body_json: Record<string, unknown>;
    variant: string | null; ab_weight: number;
  }>;
  if (variants.length === 1) {
    const r = variants[0]!;
    return { id: r.id, subject: r.subject, body_json: r.body_json, variant: r.variant };
  }

  // 가중 랜덤 (recipientEmail 있으면 결정적, 없으면 진짜 랜덤)
  const totalWeight = variants.reduce((acc, v) => acc + Math.max(0, v.ab_weight), 0);
  if (totalWeight === 0) {
    const r = variants[0]!;
    return { id: r.id, subject: r.subject, body_json: r.body_json, variant: r.variant };
  }
  const seed = recipientEmail
    ? hashStringToInt(recipientEmail) % totalWeight
    : Math.floor(Math.random() * totalWeight);

  let cur = 0;
  for (const v of variants) {
    cur += Math.max(0, v.ab_weight);
    if (seed < cur) {
      return { id: v.id, subject: v.subject, body_json: v.body_json, variant: v.variant };
    }
  }
  const r = variants[variants.length - 1]!;
  return { id: r.id, subject: r.subject, body_json: r.body_json, variant: r.variant };
}

/**
 * AB 발송 로그.
 */
export async function logAbDispatch(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    templateId: string;
    recipientEmail: string;
    variant: string | null;
    refKind?: string;
    refId?: string;
  },
): Promise<void> {
  await supabase.from("email_ab_dispatches").insert({
    org_id: params.orgId,
    template_id: params.templateId,
    recipient_email: params.recipientEmail,
    variant: params.variant,
    ref_kind: params.refKind ?? null,
    ref_id: params.refId ?? null,
  });
}
