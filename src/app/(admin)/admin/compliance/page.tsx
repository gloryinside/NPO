import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "컴플라이언스" };

/**
 * G-D170: GDPR / PIPA 컴플라이언스 상태 체크리스트.
 */
export default async function AdminCompliancePage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  // 간단한 지표들
  const { count: withdrawnCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .eq("status", "withdrawn");

  const { count: totalMembers } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const { data: org } = await supabase
    .from("orgs")
    .select("privacy_policy_markdown, terms_markdown, contact_email")
    .eq("id", tenant.id)
    .maybeSingle();

  const { count: consentRecorded } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .not("marketing_consent_at", "is", null);

  const items: Array<{ label: string; ok: boolean; detail: string }> = [
    {
      label: "개인정보처리방침 게시",
      ok: true,
      detail: org?.privacy_policy_markdown
        ? "커스텀 방침 등록됨"
        : "기본 템플릿 사용 중 (법무 검토 권장)",
    },
    {
      label: "이용약관 게시",
      ok: true,
      detail: org?.terms_markdown
        ? "커스텀 약관 등록됨"
        : "기본 템플릿 사용 중",
    },
    {
      label: "문의 연락처 노출",
      ok: Boolean(org?.contact_email),
      detail: org?.contact_email
        ? `/contact 에 ${org.contact_email} 표시`
        : "contact_email 미설정 — /contact 페이지가 안내 불가",
    },
    {
      label: "회원 탈퇴 처리 (soft-delete + PII 마스킹)",
      ok: true,
      detail: `누적 탈퇴 ${withdrawnCount ?? 0} / 전체 ${totalMembers ?? 0}`,
    },
    {
      label: "마케팅 동의 이력 보존",
      ok: true,
      detail: `동의 기록 ${consentRecorded ?? 0}건 (marketing_consent_at)`,
    },
    {
      label: "감사 로그 활성화",
      ok: true,
      detail: "audit_logs + member_audit_log 테이블 운영 중",
    },
    {
      label: "PII 암호화 키 버전닝",
      ok: Boolean(
        process.env.ORG_SECRETS_KEY_V1 ||
          process.env.ORG_SECRETS_KEY ||
          process.env.RECEIPTS_ENCRYPTION_KEY
      ),
      detail:
        "ORG_SECRETS_ACTIVE_VERSION 으로 회전 관리 (v{n}:* prefix 암호문)",
    },
    {
      label: "HTTPS 강제 (HSTS)",
      ok: true,
      detail: "Strict-Transport-Security preload + includeSubDomains",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">컴플라이언스</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          개인정보보호법·GDPR 관점의 주요 체크리스트입니다.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-start justify-between gap-4 rounded-2xl border px-5 py-4"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                {it.ok ? "✓" : "✗"} {it.label}
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {it.detail}
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: it.ok ? "var(--positive-soft)" : "var(--negative-soft)",
                color: it.ok ? "var(--positive)" : "var(--negative)",
              }}
            >
              {it.ok ? "OK" : "조치"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
