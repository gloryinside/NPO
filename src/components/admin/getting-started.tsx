import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkOrgForReceipt } from "@/lib/receipt/validation";

/**
 * 대시보드 "시작하기" — 처음 쓰는 기관이 모금을 시작하기 전에 꼭 해야 할 일.
 * 교육 없이도 순서대로 따라 하면 되도록, 각 단계는 "왜 필요한지" 한 줄과 바로 가는 버튼을 가진다.
 * 필수 단계를 모두 마치면 사라진다.
 */
type Step = { id: string; title: string; why: string; href: string; action: string; done: boolean; optional?: boolean };

export async function GettingStarted({ orgId }: { orgId: string }) {
  const supabase = createSupabaseAdminClient();
  const [orgRes, secretsRes, campaignsRes] = await Promise.all([
    supabase
      .from("orgs")
      .select("name, business_no, address, representative_name, donee_code, donation_type_code, published_at")
      .eq("id", orgId)
      .maybeSingle(),
    supabase.from("org_secrets").select("toss_secret_key_enc, erp_webhook_url").eq("org_id", orgId).maybeSingle(),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
  ]);

  const org = orgRes.data;
  const secrets = secretsRes.data as { toss_secret_key_enc?: string | null; erp_webhook_url?: string | null } | null;
  const receiptReady = !!org && checkOrgForReceipt(org).every((i) => !i.blocking);

  const steps: Step[] = [
    {
      id: "org",
      title: "기관 정보 입력",
      why: "대표자·사업자등록번호·주소가 있어야 기부금영수증을 발급할 수 있어요.",
      href: "/admin/settings",
      action: "기관 정보 입력하기",
      done: receiptReady,
    },
    {
      id: "payment",
      title: "결제 연결",
      why: "토스페이먼츠 키를 넣어야 카드·계좌로 후원을 받을 수 있어요.",
      href: "/admin/settings#toss",
      action: "결제 연결하기",
      done: !!secrets?.toss_secret_key_enc,
    },
    {
      id: "campaign",
      title: "첫 캠페인 열기",
      why: "무엇을 위해 모금하는지 알리는 페이지예요. 열려 있어야 후원을 받을 수 있어요.",
      href: "/admin/campaigns",
      action: "캠페인 만들기",
      done: (campaignsRes.count ?? 0) > 0,
    },
    {
      id: "home",
      title: "후원 홈페이지 게시",
      why: "후원자가 처음 보게 되는 기관 소개 화면이에요. 템플릿으로 몇 분이면 만들 수 있어요.",
      href: "/admin/landing",
      action: "홈페이지 만들기",
      done: !!org?.published_at,
    },
    {
      id: "erp",
      title: "회계(ERP) 연결",
      why: "연결하면 들어온 후원금이 회계 시스템으로 자동 전송돼요. 나중에 해도 됩니다.",
      href: "/admin/settings#erp",
      action: "ERP 연결하기",
      done: !!secrets?.erp_webhook_url,
      optional: true,
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  if (doneCount === required.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section
      aria-labelledby="getting-started-title"
      className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="getting-started-title" className="text-base font-semibold text-[var(--text)]">
          모금을 시작하려면 {required.length - doneCount}단계가 남았어요
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          {doneCount}/{required.length} 완료
        </p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-label="시작하기 진행률"
        aria-valuemin={0}
        aria-valuemax={required.length}
        aria-valuenow={doneCount}
      >
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(doneCount / required.length) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const isNext = s.id === next?.id;
          return (
            <li
              key={s.id}
              className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${
                isNext ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${s.done ? "text-[var(--muted-foreground)] line-through" : "text-[var(--text)]"}`}>
                  {s.title}
                  {s.optional && <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">(선택)</span>}
                  <span className="sr-only">{s.done ? " — 완료" : " — 아직 안 함"}</span>
                </p>
                {!s.done && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{s.why}</p>}
              </div>
              {!s.done && (
                <Link
                  href={s.href}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-center text-sm font-semibold no-underline ${
                    isNext
                      ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {s.action}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
