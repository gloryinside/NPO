import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeBillingAuth } from "@/lib/billing/complete-billing-auth";

/** 후원자 결제수단 변경 완료(토스 결제창 successUrl) — 본인 약정만, 새 카드로 교체 후 예전 키 삭제 */
type SP = Promise<{ promiseId?: string; authKey?: string; customerKey?: string }>;

export default async function DonorBillingSuccessPage({ searchParams }: { searchParams: SP }) {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");
  const sp = await searchParams;
  const result = await completeBillingAuth(createSupabaseAdminClient(), session.member.org_id, sp, {
    mode: "replace",
    memberId: session.member.id,
  });
  redirect(result.ok ? "/donor/promises?card=updated" : `/donor/promises?card=failed&reason=${result.reason}`);
}
