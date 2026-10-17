import Image from "next/image";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeBillingAuth } from "@/lib/billing/complete-billing-auth";

/**
 * 정기후원 카드 등록 완료(토스 결제창 requestBillingAuth의 successUrl).
 * 쿼리: promiseId(우리가 붙임), authKey·customerKey(토스가 붙임)
 */
type SP = Promise<{ promiseId?: string; authKey?: string; customerKey?: string }>;

const REASON_MESSAGE: Record<string, string> = {
  invalid_request: "잘못된 요청입니다. 후원 신청을 처음부터 다시 진행해 주세요.",
  not_found: "후원 신청 정보를 찾을 수 없습니다.",
  customer_mismatch: "카드 등록 정보가 후원 신청과 일치하지 않습니다.",
  toss_unavailable: "이 기관의 결제 설정이 완료되지 않았습니다. 기관에 문의해 주세요.",
  issue_failed: "카드 등록에 실패했습니다. 카드 정보를 확인한 뒤 다시 시도해 주세요.",
  save_failed: "카드 등록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default async function BillingSuccessPage({ searchParams }: { searchParams: SP }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const result = await completeBillingAuth(createSupabaseAdminClient(), tenant.id, sp);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="animate-rise rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-card">
        {result.ok ? (
          <>
            <Image src="/img/success/donated.webp" alt="" width={480} height={320} priority className="art-adapt mx-auto mb-2 h-48 w-auto" />
            <p className="eyebrow">Monthly Giving</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[var(--text)]">정기후원이 시작되었습니다</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              매월 {result.amount.toLocaleString("ko-KR")}원이 등록하신 카드로 결제됩니다. (약정번호 {result.promiseCode})
            </p>
            <a href="/donor" className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow hover:bg-[var(--accent-hover)]">
              내 후원 보기
            </a>
          </>
        ) : (
          <>
            <Image src="/img/error/500.webp" alt="" width={480} height={320} className="art-adapt mx-auto mb-2 h-40 w-auto" />
            <h1 className="text-xl font-bold text-[var(--text)]">카드 등록을 완료하지 못했습니다</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{REASON_MESSAGE[result.reason]}</p>
            <a href="/" className="mt-6 inline-flex rounded-xl border border-[var(--input)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] no-underline hover:bg-[var(--surface-2)]">
              처음으로
            </a>
          </>
        )}
      </div>
    </main>
  );
}
