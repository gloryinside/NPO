import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateReceiptCode } from '@/lib/codes';
import { generateReceiptPdf, type ReceiptData } from '@/lib/receipt/pdf';
import { notifyReceiptIssued } from '@/lib/notifications/send';

type BatchResult = { issued: number; skipped: number; failed: number };

export async function issueAnnualReceipts(orgId: string, year: number): Promise<BatchResult> {
  const supabase = createSupabaseAdminClient();
  const result: BatchResult = { issued: 0, skipped: 0, failed: 0 };

  // 1. Fetch paid payments with receipt_opt_in for the year
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('member_id, amount, pay_date, campaigns(title)')
    .eq('org_id', orgId)
    .eq('pay_status', 'paid')
    .eq('receipt_opt_in', true)
    .gte('pay_date', startDate)
    .lt('pay_date', endDate);

  if (payErr || !payments || payments.length === 0) return result;

  // 2. Group by member_id
  const memberMap = new Map<string, { total: number; payments: Array<{ payDate: string; campaignTitle: string | null; amount: number }> }>();

  for (const p of payments) {
    const mid = p.member_id as string;
    const amount = p.amount as number;
    const campaign = p.campaigns as unknown as { title: string | null } | null;

    if (!memberMap.has(mid)) {
      memberMap.set(mid, { total: 0, payments: [] });
    }
    const entry = memberMap.get(mid)!;
    entry.total += amount;
    entry.payments.push({
      payDate: p.pay_date as string,
      campaignTitle: campaign?.title ?? null,
      amount,
    });
  }

  // 3. Check existing receipts for this org+year
  const { data: existing } = await supabase
    .from('receipts')
    .select('member_id')
    .eq('org_id', orgId)
    .eq('year', year);

  const alreadyIssued = new Set((existing ?? []).map((r) => r.member_id as string));

  // 4. Get org info
  const { data: org } = await supabase
    .from('orgs')
    .select('name, business_no, address, contact_phone, contact_email')
    .eq('id', orgId)
    .single();

  // 5. Get current max sequence for receipt codes
  const { count: existingCount } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('year', year);

  let seq = (existingCount ?? 0) + 1;

  // 6. Process each member
  for (const [memberId, data] of memberMap) {
    if (alreadyIssued.has(memberId)) {
      result.skipped++;
      continue;
    }

    try {
      // Fetch member info
      const { data: member } = await supabase
        .from('members')
        .select('name, phone, email, birth_date')
        .eq('id', memberId)
        .single();

      if (!member) {
        result.failed++;
        continue;
      }

      const receiptCode = generateReceiptCode(year, seq);
      const issuedAt = new Date().toISOString();

      const receiptData: ReceiptData = {
        receiptCode,
        year,
        org: {
          name: org?.name ?? '',
          businessNo: (org?.business_no as string | null) ?? null,
          address: (org?.address as string | null) ?? null,
          contactPhone: (org?.contact_phone as string | null) ?? null,
          contactEmail: (org?.contact_email as string | null) ?? null,
        },
        member: {
          name: member.name as string,
          phone: (member.phone as string | null) ?? null,
          birthDate: (member.birth_date as string | null) ?? null,
        },
        totalAmount: data.total,
        payments: data.payments,
        issuedAt,
      };

      // Generate PDF
      const pdfBuffer = await generateReceiptPdf(receiptData);

      // Upload to Storage
      const storagePath = `${orgId}/${year}/${receiptCode}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

      if (uploadErr) throw uploadErr;

      // Create signed URL (1 year)
      const { data: signedData, error: signErr } = await supabase.storage
        .from('receipts')
        .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

      if (signErr) throw signErr;

      const pdfUrl = signedData?.signedUrl ?? null;

      // Insert receipt row
      const { error: insertErr } = await supabase.from('receipts').insert({
        org_id: orgId,
        receipt_code: receiptCode,
        member_id: memberId,
        year,
        total_amount: data.total,
        pdf_url: pdfUrl,
        issued_at: issuedAt,
        issued_by: 'system:annual-batch',
      });

      if (insertErr) throw insertErr;

      // Notify
      notifyReceiptIssued({
        phone: (member.phone as string | null) ?? null,
        email: (member.email as string | null) ?? null,
        name: member.name as string,
        year,
        pdfUrl,
        orgName: org?.name ?? '',
        receiptCode,
        totalAmount: data.total,
      });

      seq++;
      result.issued++;
    } catch (err) {
      console.error(`[annual-batch] Failed for member=${memberId} org=${orgId}`, err);
      result.failed++;
    }
  }

  return result;
}
