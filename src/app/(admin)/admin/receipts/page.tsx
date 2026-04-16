import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKRW, formatDateKR } from "@/lib/format";
import { ReceiptBulkActions } from "@/components/admin/receipt-bulk-actions";

type SearchParams = Promise<{ year?: string }>;

type MemberReceiptRow = {
  memberId: string;
  memberName: string;
  idNumberSet: boolean;
  payCount: number;
  totalAmount: number;
  receiptIssued: boolean;
  receiptCode: string | null;
  receiptPdfUrl: string | null;
  issuedAt: string | null;
};

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear() - 1;

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // 1) 해당 연도 paid 납입이 있는 회원 목록 집계
  const { data: paymentsRaw } = await supabase
    .from("payments")
    .select("member_id, amount, members!inner(id, name, id_number_encrypted)")
    .eq("org_id", tenant.id)
    .eq("pay_status", "paid")
    .gte("pay_date", yearStart)
    .lt("pay_date", yearEnd);

  type PayRow = {
    member_id: string;
    amount: number | null;
    members: { id: string; name: string; id_number_encrypted: string | null } | null;
  };

  const pays = (paymentsRaw as unknown as PayRow[]) ?? [];

  // member별 집계
  const memberMap = new Map<
    string,
    { name: string; idSet: boolean; count: number; total: number }
  >();
  for (const p of pays) {
    if (!p.member_id || !p.members) continue;
    const cur = memberMap.get(p.member_id) ?? {
      name: p.members.name,
      idSet: !!p.members.id_number_encrypted,
      count: 0,
      total: 0,
    };
    cur.count += 1;
    cur.total += Number(p.amount ?? 0);
    memberMap.set(p.member_id, cur);
  }

  // 2) 이미 발급된 영수증 조회
  const memberIds = Array.from(memberMap.keys());
  const issuedMap = new Map<
    string,
    { code: string; pdfUrl: string | null; issuedAt: string | null }
  >();

  if (memberIds.length > 0) {
    const { data: issued } = await supabase
      .from("receipts")
      .select("member_id, receipt_code, pdf_url, issued_at")
      .eq("org_id", tenant.id)
      .eq("year", year)
      .in("member_id", memberIds);

    for (const r of issued ?? []) {
      const row = r as {
        member_id: string;
        receipt_code: string;
        pdf_url: string | null;
        issued_at: string | null;
      };
      issuedMap.set(row.member_id, {
        code: row.receipt_code,
        pdfUrl: row.pdf_url,
        issuedAt: row.issued_at,
      });
    }
  }

  // 3) 최종 목록 조합
  const rows: MemberReceiptRow[] = Array.from(memberMap.entries()).map(
    ([memberId, info]) => {
      const issued = issuedMap.get(memberId);
      return {
        memberId,
        memberName: info.name,
        idNumberSet: info.idSet,
        payCount: info.count,
        totalAmount: info.total,
        receiptIssued: !!issued,
        receiptCode: issued?.code ?? null,
        receiptPdfUrl: issued?.pdfUrl ?? null,
        issuedAt: issued?.issuedAt ?? null,
      };
    }
  );

  const issuedCount = rows.filter((r) => r.receiptIssued).length;
  const pendingCount = rows.length - issuedCount;
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
  const noIdCount = rows.filter((r) => !r.idNumberSet).length;

  // 연도 선택 옵션 (현재 연도 기준 5년)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">기부금영수증 관리</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            연간 기부금영수증 발급 및 국세청 간소화 자료를 관리합니다.
          </p>
        </div>

        {/* 연도 선택 */}
        <form method="get">
          <select
            name="year"
            defaultValue={year}
            onChange={(e) => {
              if (typeof window !== "undefined") {
                window.location.href = `/admin/receipts?year=${(e.target as HTMLSelectElement).value}`;
              }
            }}
            className="rounded-lg border px-3 py-2 text-sm bg-[var(--surface)] border-[var(--border)] text-[var(--text)]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </form>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="발급 대상" value={`${rows.length}명`} />
        <SummaryCard title="발급 완료" value={`${issuedCount}명`} positive />
        <SummaryCard
          title="미발급"
          value={`${pendingCount}명`}
          negative={pendingCount > 0}
        />
        <SummaryCard title={`${year}년 기부금 합계`} value={formatKRW(grandTotal)} />
      </div>

      {noIdCount > 0 && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--warning)",
            background: "rgba(234,179,8,0.08)",
            color: "var(--text)",
          }}
        >
          ⚠️ 주민번호 미등록 후원자 <strong>{noIdCount}명</strong>은 국세청 간소화 자료에서 제외됩니다.
          후원자 상세 페이지에서 주민번호를 입력해 주세요.
        </div>
      )}

      {/* 일괄 처리 버튼 */}
      <ReceiptBulkActions year={year} rows={rows} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = negative
    ? "var(--negative)"
    : positive
    ? "var(--positive)"
    : "var(--text)";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs text-[var(--muted-foreground)] mb-1">{title}</div>
      <div className="text-xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
