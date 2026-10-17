/**
 * 신청 때 받은 주민등록번호(또는 기업 사업자등록번호)를 후원자 정보로 옮긴다.
 *
 * 신청서는 로그인 없이 제출되므로, 받은 번호는 우선 결제 행(payments.rrn_pending_encrypted)에만 둔다.
 * 돈이 실제로 들어온 것이 확인됐을 때(결제 승인·CMS 출금 성공·관리자 입금 확인·통장 대사)에만 후원자에게 옮긴다 —
 * 남의 휴대폰 번호로 신청서만 내서 그 사람의 영수증 번호를 바꾸지 못하게.
 *
 * 이미 번호가 있는 후원자는 덮어쓰지 않는다. 어느 경우든 결제 행의 대기 값은 지운다.
 * 같은 키·같은 알고리즘이라 암호문을 그대로 옮긴다(평문을 만들지 않는다).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function promotePendingIdNumber(supabase: SupabaseClient, orgId: string, paymentId: string): Promise<void> {
  try {
    const { data: p } = await supabase
      .from("payments")
      .select("member_id, rrn_pending_encrypted, pay_status")
      .eq("id", paymentId)
      .eq("org_id", orgId)
      .maybeSingle();
    const row = p as { member_id: string | null; rrn_pending_encrypted: string | null; pay_status: string } | null;
    if (!row?.rrn_pending_encrypted || row.pay_status !== "paid") return;

    const nowIso = new Date().toISOString();
    if (row.member_id) {
      const { error } = await supabase
        .from("members")
        .update({ id_number_encrypted: row.rrn_pending_encrypted, rrn_consent_at: nowIso, updated_at: nowIso })
        .eq("id", row.member_id)
        .eq("org_id", orgId)
        .is("id_number_encrypted", null);
      if (error) {
        console.error("[receipt] 번호 옮기기 실패:", error.message);
        return;
      }
    }
    await supabase
      .from("payments")
      .update({ rrn_pending_encrypted: null, updated_at: nowIso })
      .eq("id", paymentId)
      .eq("org_id", orgId);
  } catch (err) {
    console.error("[receipt] 번호 옮기기 실패:", err);
  }
}
