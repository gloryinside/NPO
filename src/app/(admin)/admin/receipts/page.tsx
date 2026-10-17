import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKRW } from "@/lib/format";
import { ReceiptBulkActions } from "@/components/admin/receipt-bulk-actions";
import { ReceiptLedgerTable } from "@/components/admin/receipt-ledger-table";
import { NtsExportPanel } from "@/components/admin/nts-export-panel";
import { collectYearDonations } from "@/lib/receipt/issue";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 후원자 이름·주민번호 등록 여부 (member_id 목록은 URL 길이 때문에 200개씩) */
async function loadMembers(supabase: SupabaseClient, orgId: string, ids: string[]) {
  const out = new Map<string, { name: string; idSet: boolean }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("members")
      .select("id, name, id_number_encrypted")
      .eq("org_id", orgId)
      .in("id", ids.slice(i, i + 200));
    for (const m of (data ?? []) as Array<{ id: string; name: string; id_number_encrypted: string | null }>) {
      out.set(m.id, { name: m.name, idSet: !!m.id_number_encrypted });
    }
  }
  return out;
}

/** 해당 연도 유효 영수증(취소·대체 제외) — 기부자별 1장 */
async function loadValidReceipts(supabase: SupabaseClient, orgId: string, year: number) {
  const out = new Map<string, { code: string; pdfUrl: string | null; issuedAt: string | null; total: number }>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("receipts")
      .select("member_id, receipt_code, pdf_url, issued_at, total_amount")
      .eq("org_id", orgId)
      .eq("year", year)
      .or("status.is.null,status.eq.issued")
      .order("id", { ascending: true })
      .range(from, from + 999);
    const page = (data ?? []) as Array<{
      member_id: string; receipt_code: string; pdf_url: string | null; issued_at: string | null; total_amount: number | null;
    }>;
    for (const r of page) {
      out.set(r.member_id, { code: r.receipt_code, pdfUrl: r.pdf_url, issuedAt: r.issued_at, total: Number(r.total_amount ?? 0) });
    }
    if (page.length < 1000) break;
  }
  return out;
}

type SearchParams = Promise<{ year?: string; tab?: string }>;

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();
  const { year: yearParam, tab = "manage" } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear() - 1;

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  // 탭 링크
  const tabLinks = (
    <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
      {[
        { key: "manage", label: "발급관리" },
        { key: "ledger", label: "발급대장" },
        { key: "nts", label: "간소화파일" },
      ].map(({ key, label }) => (
        <a
          key={key}
          href={`/admin/receipts?tab=${key}&year=${year}`}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === key
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted-foreground)]"
          }`}
        >
          {label}
        </a>
      ))}
    </div>
  );

  // 연도 선택 (form submit)
  const yearSelect = (
    <form method="get" action="/admin/receipts">
      <input type="hidden" name="tab" value={tab} />
      <select
        name="year"
        defaultValue={year}
        title="귀속연도 선택"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
    </form>
  );

  // ── 발급관리 탭 ──
  if (tab === "manage") {
    // 발급 로직과 같은 기준: KST 연도 결제 완료분의 환불 차감 순액, 전체 페이지(1000행 제한 없음)
    const donations = await collectYearDonations(supabase, tenant.id, year, { requireOptIn: false });
    const memberIds = Array.from(donations.keys());
    const [membersById, validReceipts] = await Promise.all([
      loadMembers(supabase, tenant.id, memberIds),
      loadValidReceipts(supabase, tenant.id, year),
    ]);
    const rows = memberIds.map((memberId) => {
      const d = donations.get(memberId)!;
      const m = membersById.get(memberId);
      const issued = validReceipts.get(memberId);
      return {
        memberId,
        memberName: m?.name ?? "(알 수 없음)",
        idNumberSet: !!m?.idSet,
        payCount: d.payments.length,
        totalAmount: d.total,
        receiptIssued: !!issued,
        receiptCode: issued?.code ?? null,
        receiptPdfUrl: issued?.pdfUrl ?? null,
        issuedAt: issued?.issuedAt ?? null,
      };
    });
    const issuedCount = rows.filter((r) => r.receiptIssued).length;
    const pendingCount = rows.length - issuedCount;
    const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
    const noIdCount = rows.filter((r) => !r.idNumberSet).length;

    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">기부금영수증</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              연간 기부금영수증 발급 및 국세청 간소화 자료를 관리합니다.
            </p>
          </div>
          {yearSelect}
        </div>
        {tabLinks}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { title: "발급 대상", value: `${rows.length}명`, positive: false, negative: false },
            { title: "발급 완료", value: `${issuedCount}명`, positive: true, negative: false },
            { title: "미발급", value: `${pendingCount}명`, positive: false, negative: pendingCount > 0 },
            { title: `${year}년 기부금 합계`, value: formatKRW(grandTotal), positive: false, negative: false },
          ].map(({ title, value, positive, negative }) => (
            <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-1 text-xs text-[var(--muted-foreground)]">{title}</div>
              <div
                className={`text-xl font-bold ${
                  negative ? "text-[var(--negative)]" : positive ? "text-[var(--positive)]" : "text-[var(--text)]"
                }`}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        {noIdCount > 0 && (
          <div className="mb-6 rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--text)]">
            ⚠️ 주민번호 미등록 후원자 <strong>{noIdCount}명</strong>은 국세청 간소화 자료에서 제외됩니다.
          </div>
        )}
        <ReceiptBulkActions year={year} rows={rows} />
      </div>
    );
  }

  // ── 발급대장 탭 ──
  if (tab === "ledger") {
    const { data: receiptsRaw } = await supabase
      .from("receipts")
      .select("member_id, receipt_code, total_amount, issued_at, pdf_url, members!inner(id, name)")
      .eq("org_id", tenant.id)
      .eq("year", year)
      .order("issued_at", { ascending: false });

    type LedgerRaw = {
      member_id: string;
      receipt_code: string;
      total_amount: number;
      issued_at: string | null;
      pdf_url: string | null;
      members: { id: string; name: string } | null;
    };
    const ledgerRows = ((receiptsRaw as unknown as LedgerRaw[]) ?? []).map((r) => ({
      memberId: r.member_id,
      memberName: r.members?.name ?? "-",
      receiptCode: r.receipt_code,
      totalAmount: Number(r.total_amount ?? 0),
      issuedAt: r.issued_at,
      pdfUrl: r.pdf_url,
    }));

    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text)]">기부금영수증 관리</h1>
          {yearSelect}
        </div>
        {tabLinks}
        <ReceiptLedgerTable rows={ledgerRows} year={year} />
      </div>
    );
  }

  // ── 간소화파일 탭 ──
  // 사람 단위로 센다(예전: 결제 건수 − 영수증 수를 "미발급 명"으로 표시). 취소·대체된 영수증은 제외.
  const [ntsDonations, ntsReceipts] = await Promise.all([
    collectYearDonations(supabase, tenant.id, year, { requireOptIn: false }),
    loadValidReceipts(supabase, tenant.id, year),
  ]);
  const ntsMembers = await loadMembers(supabase, tenant.id, Array.from(ntsReceipts.keys()));
  const issuedRows = Array.from(ntsReceipts.entries()).map(([memberId, r]) => ({
    memberId,
    total: r.total,
    idSet: !!ntsMembers.get(memberId)?.idSet,
  }));
  const eligibleRows = issuedRows.filter((r) => r.idSet);
  const noIdCount = issuedRows.length - eligibleRows.length;
  const pendingDonors = Array.from(ntsDonations.keys()).filter((id) => !ntsReceipts.has(id)).length;

  const summary = {
    issuedCount: issuedRows.length,
    pendingCount: pendingDonors,
    noIdCount,
    eligibleCount: eligibleRows.length,
    totalAmount: eligibleRows.reduce((s, r) => s + r.total, 0),
  };

  const { data: logsRaw } = await supabase
    .from("nts_export_logs")
    .select("id, created_at, year, member_count, total_amount, file_url")
    .eq("org_id", tenant.id)
    .eq("year", year)
    .order("created_at", { ascending: false })
    .limit(20);

  type LogRaw = {
    id: string;
    created_at: string;
    year: number;
    member_count: number | null;
    total_amount: number | null;
    file_url: string | null;
  };
  const logs = ((logsRaw as unknown as LogRaw[]) ?? []).map((l) => ({
    id: l.id,
    createdAt: l.created_at,
    year: l.year,
    memberCount: l.member_count,
    totalAmount: l.total_amount,
    fileUrl: l.file_url,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text)]">기부금영수증 관리</h1>
        {yearSelect}
      </div>
      {tabLinks}
      <NtsExportPanel year={year} summary={summary} logs={logs} />
    </div>
  );
}
