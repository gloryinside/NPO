import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { readOfficer } from "@/lib/legal/privacy-settings";
import { isStoredOverseas, storageLocation } from "@/lib/legal/processors";
import { PrivacyOfficerForm } from "@/components/admin/privacy-officer-form";

export const metadata = { title: "개인정보 보호" };

type Item = { label: string; state: "ok" | "warn" | "todo"; detail: string };

/**
 * 개인정보 보호 점검 — 실제 설정·기록을 보고 판단한다(늘 OK 로 두지 않는다).
 * 근거: 개인정보 보호법(제21·26·28조의8·30·31조), 개인정보의 안전성 확보조치 기준.
 */
export default async function AdminCompliancePage() {
  const user = await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: org }, { count: consentCount }, { count: viewLogs }, { roles }] = await Promise.all([
    supabase
      .from("orgs")
      .select("privacy_policy_markdown, terms_markdown, contact_email, privacy_settings, admin_mfa_required")
      .eq("id", tenant.id)
      .maybeSingle(),
    supabase.from("consent_records").select("id", { count: "exact", head: true }).eq("org_id", tenant.id).gte("created_at", since),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("org_id", tenant.id).eq("action", "member.view").gte("created_at", since),
    getAdminRoles(user.id, tenant.id),
  ]);

  const officer = readOfficer(org?.privacy_settings);
  const ps = (org?.privacy_settings ?? {}) as { auto_anonymize?: boolean; retention_days?: number };
  const location = storageLocation();
  const overseas = isStoredOverseas(location);
  const keyOk = Boolean(process.env.ORG_SECRETS_KEY_V1 || process.env.ORG_SECRETS_KEY || process.env.RECEIPTS_ENCRYPTION_KEY);

  const items: Item[] = [
    {
      label: "개인정보 보호책임자 지정·공개",
      state: officer ? "ok" : "todo",
      detail: officer ? `${officer.name} — 처리방침 12항에 공개 중` : "아래에서 지정해 주세요. 지정하지 않으면 처리방침에 '지정 필요'로 보입니다.",
    },
    {
      label: "개인정보 처리방침",
      state: org?.privacy_policy_markdown ? "warn" : "ok",
      detail: org?.privacy_policy_markdown
        ? "기관이 직접 쓴 방침을 쓰고 있습니다. 위탁·국외 이전·보호책임자·파기 등 필수 항목이 모두 있는지 직접 확인해 주세요."
        : "기본 방침 사용 — 필수 항목과 실제 위탁·국외 이전 대상이 자동으로 들어갑니다.",
    },
    {
      label: "데이터 저장 위치·국외 이전 고지",
      state: !location ? "todo" : overseas ? "warn" : "ok",
      detail: !location
        ? "운영 DB 저장 위치(DATA_STORAGE_LOCATION)가 설정되지 않아 처리방침에 '확인 필요'로 표시됩니다. 플랫폼 운영자에게 요청하세요."
        : overseas
          ? `${location}에 보관 — 처리방침 6항에 국외 이전으로 고지 중입니다. 국내(서울) 보관으로 옮기면 고지 부담이 줄어듭니다.`
          : `${location}에 보관(국내)`,
    },
    {
      label: "위탁 대상(시스템 운영사) 표기",
      state: process.env.PLATFORM_OPERATOR_NAME?.trim() ? "ok" : "todo",
      detail: process.env.PLATFORM_OPERATOR_NAME?.trim()
        ? `${process.env.PLATFORM_OPERATOR_NAME} — 처리방침 5항에 수탁자로 표기 중. 위탁 계약서(업무 범위·안전조치·재위탁 제한)도 갖춰 두세요.`
        : "시스템 운영사명(PLATFORM_OPERATOR_NAME)이 설정되지 않아 처리방침에 '확인 필요'로 표시됩니다. 플랫폼 운영자에게 요청하세요.",
    },
    {
      label: "후원 신청 동의 기록",
      state: "ok",
      detail: `최근 30일 동의 기록 ${consentCount ?? 0}건 — 약관·수집이용·만 14세 이상·마케팅·주민번호 동의를 문구 판과 함께 보관`,
    },
    {
      label: "보유기간 지난 정보 자동 파기",
      state: ps.auto_anonymize === false ? "todo" : "ok",
      detail: ps.auto_anonymize === false
        ? "자동 파기가 꺼져 있습니다. 탈퇴 후 보유기간이 지난 정보를 직접 파기해야 합니다."
        : `탈퇴 후 ${Number(ps.retention_days ?? 1825)}일 지나면 익명 처리(주민번호·본인확인값 포함), 결제 안 된 신청의 주민번호는 취소 즉시·90일 후 파기`,
    },
    {
      label: "개인정보 처리 기록(접속기록)",
      state: "ok",
      detail: `후원자 조회·내려받기·변경을 계정·일시·IP와 함께 기록(수정·삭제 불가). 최근 30일 후원자 조회 ${viewLogs ?? 0}건`,
    },
    {
      label: "관리자 2단계 인증",
      state: org?.admin_mfa_required ? "ok" : "warn",
      detail: org?.admin_mfa_required ? "모든 관리자에게 요구 중" : "권장 — 설정 > 2단계 인증에서 모든 관리자에게 요구할 수 있습니다.",
    },
    {
      label: "주민등록번호 암호화",
      state: keyOk ? "ok" : "todo",
      detail: keyOk ? "암호화 키 설정됨(버전 관리)" : "암호화 키가 설정되지 않았습니다. 플랫폼 운영자에게 요청하세요.",
    },
    {
      label: "문의 연락처",
      state: org?.contact_email ? "ok" : "todo",
      detail: org?.contact_email ? `${org.contact_email}` : "기관 문의 이메일을 설정해 주세요.",
    },
  ];

  const badge = { ok: ["OK", "var(--positive)", "var(--positive-soft)"], warn: ["확인", "var(--warning)", "var(--warning-soft)"], todo: ["조치", "var(--negative)", "var(--negative-soft)"] } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">개인정보 보호</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          개인정보 보호법과 안전성 확보조치 기준에서 기관이 챙겨야 할 것을 실제 설정·기록으로 점검합니다. 법률 자문을 대신하지는 않습니다.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">개인정보 보호책임자</h2>
        <PrivacyOfficerForm initial={officer} canEdit={roles.includes("super")} />
      </section>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">{it.label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{it.detail}</p>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: badge[it.state][2], color: badge[it.state][1] }}>
              {badge[it.state][0]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--muted-foreground)]">
        <a href="/privacy" target="_blank" rel="noopener" className="underline">공개 중인 개인정보 처리방침 보기</a>
      </p>
    </div>
  );
}
