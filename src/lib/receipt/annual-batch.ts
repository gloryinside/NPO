import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyReceiptIssued } from '@/lib/notifications/send';
import { collectYearDonations, issueReceipt, loadOrgForReceipt } from './issue';

export type BatchResult = { issued: number; skipped: number; failed: number; blocked?: string[] };

/**
 * 연말 일괄 발급 — 영수증 신청(receipt_opt_in)한 결제가 있는 기부자에게 연 1장.
 * 이미 유효한 영수증이 있는 기부자는 건너뛴다(멱등 — 다시 돌려도 중복 없음).
 * 예전 구현은 issued_by(uuid)에 'system:annual-batch' 문자열을 넣어 매번 저장에 실패했다.
 */
export async function issueAnnualReceipts(
  orgId: string,
  year: number,
  opts: {
    /** 관리자 일괄 발급: 화면에서 고른 기부자만. 없으면 해당 연도 전체 */
    memberIds?: string[];
    /** 연말 자동 발급은 영수증 신청자만(기본). 관리자 발급은 신청 여부와 무관 */
    requireOptIn?: boolean;
    issuedBy?: string | null;
  } = {},
): Promise<BatchResult> {
  const supabase = createSupabaseAdminClient();
  const result: BatchResult = { issued: 0, skipped: 0, failed: 0 };

  const org = await loadOrgForReceipt(supabase, orgId);
  if (!org) return result;

  const donations = await collectYearDonations(supabase, orgId, year, {
    memberIds: opts.memberIds,
    requireOptIn: opts.requireOptIn ?? true,
  });

  for (const [memberId, d] of donations) {
    const r = await issueReceipt(supabase, { org, memberId, year, donations: d, issuedBy: opts.issuedBy ?? null });
    switch (r.kind) {
      case 'issued': {
        const { data: member } = await supabase
          .from('members')
          .select('name, phone, email')
          .eq('id', memberId)
          .eq('org_id', orgId)
          .maybeSingle();
        notifyReceiptIssued({
          orgId,
          phone: member?.phone ?? null,
          email: member?.email ?? null,
          name: member?.name ?? '',
          year,
          pdfUrl: r.pdfUrl,
          orgName: org.name ?? '',
          receiptCode: r.receiptCode,
          totalAmount: r.total,
        });
        result.issued++;
        break;
      }
      case 'existing':
      case 'no_donations':
        result.skipped++;
        break;
      case 'blocked':
        // 기관 기재사항 누락 — 이 기관은 전부 막히므로 바로 중단하고 사유를 남긴다
        result.blocked = r.issues.map((i) => i.message);
        console.error(`[annual-batch] org ${orgId}: 기관 정보 누락으로 발급 중단`, result.blocked);
        return result;
      case 'failed':
        console.error(`[annual-batch] member=${memberId} org=${orgId}: ${r.error}`);
        result.failed++;
        break;
    }
  }
  return result;
}
