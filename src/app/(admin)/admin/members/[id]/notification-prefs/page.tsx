import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "회원 알림 설정 (관리자)" };

const LABELS: Record<string, string> = {
  amount_change: "금액 변경 알림",
  payment_confirmation: "결제 완료",
  receipt_issued: "영수증 발급",
  promise_status: "약정 상태 변경",
  campaign_update: "캠페인 소식",
};

type RouteCtx = { params: Promise<{ id: string }> };

export default async function AdminMemberNotifPrefsPage({ params }: RouteCtx) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: member } = await supabase
    .from("members")
    .select(
      "id, name, email, phone, email_disabled, email_disabled_reason, notification_prefs, marketing_consent, marketing_consent_at"
    )
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!member) notFound();

  const prefs = (member.notification_prefs as Record<string, boolean>) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {member.name}님 알림 설정
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          관리자 읽기 전용 뷰입니다. 회원 본인만 값을 변경할 수 있습니다.
        </p>
      </div>

      <section
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="이메일" value={member.email ?? "-"} />
          <Field label="전화번호" value={member.phone ?? "-"} />
          <Field
            label="이메일 수신"
            value={
              member.email_disabled
                ? `🚫 차단 (${member.email_disabled_reason ?? "-"})`
                : "✅ 가능"
            }
          />
          <Field
            label="마케팅 동의"
            value={
              member.marketing_consent
                ? `✅ 동의 (${member.marketing_consent_at?.slice(0, 10) ?? "-"})`
                : "❌ 미동의"
            }
          />
        </div>
      </section>

      <section>
        <h2
          className="mb-3 text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          알림 종류별 수신 여부
        </h2>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <ul>
            {Object.entries(LABELS).map(([key, label], idx) => (
              <li
                key={key}
                className="flex items-center justify-between px-5 py-3"
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--text)" }}>{label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: prefs[key]
                      ? "var(--positive-soft)"
                      : "var(--negative-soft)",
                    color: prefs[key] ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {prefs[key] ? "수신" : "차단"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-xs uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}
