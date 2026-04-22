"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PayStatus, IncomeStatus, PaymentWithRelations } from "@/types/payment";
import { RefundDialog } from "@/components/admin/refund-dialog";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailDrawer } from "@/components/common/detail-drawer";
import { FilterBar, FilterDropdown } from "@/components/common/filter-bar";
import { formatKRW } from "@/lib/format";

type Props = {
  payments: PaymentWithRelations[];
  total: number;
  initialStatus: string;
  stats: {
    monthPaidTotal: number;
    unpaidCount: number;
    cmsSuccessRate: number;
    pendingIncomeCount: number;
  };
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "전체" },
  { value: "paid", label: "완료" },
  { value: "pending", label: "대기" },
  { value: "failed", label: "실패" },
];

const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  paid: "완료",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환불",
  pending: "대기",
};

const PAY_STATUS_CLASS: Record<PayStatus, string> = {
  paid: "bg-[var(--positive-soft)] text-[var(--positive)]",
  pending: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  unpaid: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  failed: "bg-[var(--negative-soft)] text-[var(--negative)]",
  cancelled: "bg-[var(--negative-soft)] text-[var(--negative)]",
  refunded: "bg-[var(--warning-soft)] text-[var(--warning)]",
};

const INCOME_STATUS_LABEL: Record<IncomeStatus, string> = {
  pending: "수입대기",
  processing: "수입진행",
  confirmed: "수입완료",
  excluded: "수입제외",
};

const INCOME_STATUS_CLASS: Record<IncomeStatus, string> = {
  pending: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  processing: "bg-[rgba(59,130,246,0.15)] text-[#3b82f6]",
  confirmed: "bg-[var(--positive-soft)] text-[var(--positive)]",
  excluded: "bg-[var(--warning-soft)] text-[var(--warning)]",
};

function PayStatusBadge({ status }: { status: PayStatus }) {
  return (
    <Badge className={`border-0 font-medium ${PAY_STATUS_CLASS[status]}`}>
      {PAY_STATUS_LABEL[status]}
    </Badge>
  );
}

function IncomeStatusBadge({ status }: { status: IncomeStatus }) {
  return (
    <Badge className={`border-0 font-medium ${INCOME_STATUS_CLASS[status]}`}>
      {INCOME_STATUS_LABEL[status]}
    </Badge>
  );
}

function formatAmount(value: number | null | undefined) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

type ManualPayForm = {
  memberId: string;
  memberName: string;
  campaignId: string;
  campaignName: string;
  amount: string;
  payDate: string;
  note: string;
};

const EMPTY_PAY: ManualPayForm = {
  memberId: "",
  memberName: "",
  campaignId: "",
  campaignName: "",
  amount: "",
  payDate: new Date().toISOString().slice(0, 10),
  note: "",
};

function AddPaymentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<ManualPayForm>(EMPTY_PAY);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<
    { id: string; name: string; member_code: string }[]
  >([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignResults, setCampaignResults] = useState<
    { id: string; title: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchMembers(q: string) {
    if (!q.trim()) { setMemberResults([]); return; }
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json();
    setMemberResults(data.members ?? []);
  }

  async function searchCampaigns(q: string) {
    if (!q.trim()) { setCampaignResults([]); return; }
    const res = await fetch(`/api/admin/campaigns?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json();
    setCampaignResults(data.campaigns ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.memberId) { setError("후원자를 선택해주세요."); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError("금액을 입력해주세요."); return; }
    if (!form.payDate) { setError("납입일을 입력해주세요."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: form.memberId,
          campaignId: form.campaignId || undefined,
          amount,
          payDate: form.payDate,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "등록 실패");
      setForm(EMPTY_PAY);
      setMemberSearch("");
      setCampaignSearch("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">납입 수동 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* 후원자 검색 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="pay-member" className="text-sm font-medium text-[var(--text)]">
              후원자 <span className="text-[var(--negative)]">*</span>
            </label>
            {form.memberId ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-[var(--surface-2)] border-[var(--border)]">
                <span className="text-sm text-[var(--text)] flex-1">{form.memberName}</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, memberId: "", memberName: "" }))}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
                >
                  변경
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="pay-member"
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
                  placeholder="이름으로 검색"
                  className={inputCls}
                />
                {memberResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-lg border bg-[var(--surface)] border-[var(--border)] shadow-lg max-h-40 overflow-y-auto">
                    {memberResults.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((p) => ({ ...p, memberId: m.id, memberName: `${m.name} (${m.member_code})` }));
                            setMemberSearch("");
                            setMemberResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                        >
                          {m.name} <span className="text-[var(--muted-foreground)]">{m.member_code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* 캠페인 선택 (선택사항) */}
          <div className="flex flex-col gap-1">
            <label htmlFor="pay-campaign" className="text-sm font-medium text-[var(--text)]">캠페인 (선택)</label>
            {form.campaignId ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-[var(--surface-2)] border-[var(--border)]">
                <span className="text-sm text-[var(--text)] flex-1">{form.campaignName}</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, campaignId: "", campaignName: "" }))}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
                >
                  제거
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="pay-campaign"
                  value={campaignSearch}
                  onChange={(e) => { setCampaignSearch(e.target.value); searchCampaigns(e.target.value); }}
                  placeholder="캠페인 이름으로 검색"
                  className={inputCls}
                />
                {campaignResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-lg border bg-[var(--surface)] border-[var(--border)] shadow-lg max-h-40 overflow-y-auto">
                    {campaignResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((p) => ({ ...p, campaignId: c.id, campaignName: c.title }));
                            setCampaignSearch("");
                            setCampaignResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                        >
                          {c.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-amount" className="text-sm font-medium text-[var(--text)]">
                금액(원) <span className="text-[var(--negative)]">*</span>
              </label>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="30000"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pay-date" className="text-sm font-medium text-[var(--text)]">
                납입일 <span className="text-[var(--negative)]">*</span>
              </label>
              <Input
                id="pay-date"
                type="date"
                value={form.payDate}
                onChange={(e) => setForm((p) => ({ ...p, payDate: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pay-note" className="text-sm font-medium text-[var(--text)]">메모</label>
            <textarea
              id="pay-note"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              rows={2}
              placeholder="계좌이체, 현금 등 납입 방법 메모"
              className={`rounded-lg border px-3 py-2 text-sm outline-none resize-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]`}
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg border px-3 py-2 text-[var(--negative)] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.4)]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">
              취소
            </Button>
            <Button type="submit" disabled={saving}
              className="bg-[var(--accent)] text-white disabled:opacity-60">
              {saving ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentList({ payments, total, initialStatus, stats }: Props) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [refundTarget, setRefundTarget] = useState<PaymentWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<PaymentWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of payments) {
      if (p.campaigns?.id) map.set(p.campaigns.id, p.campaigns.title);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [payments]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      if (p.pg_method) set.add(p.pg_method);
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      if (q) {
        const name = (p.members?.name ?? "").toLowerCase();
        const code = (p.payment_code ?? "").toLowerCase();
        const title = (p.campaigns?.title ?? "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !title.includes(q)) {
          return false;
        }
      }
      if (campaignFilter && p.campaigns?.id !== campaignFilter) return false;
      if (methodFilter && p.pg_method !== methodFilter) return false;
      return true;
    });
  }, [payments, searchQuery, campaignFilter, methodFilter]);

  const hasActiveFilters = !!(searchQuery || campaignFilter || methodFilter);

  function resetFilters() {
    setSearchQuery("");
    setCampaignFilter(null);
    setMethodFilter(null);
  }

  const pageTabs = STATUS_TABS.map((t) => ({
    key: t.value,
    label: t.label,
    href: t.value === "all" ? "/admin/payments" : `/admin/payments?status=${t.value}`,
  }));

  const columns: DataTableColumn<PaymentWithRelations>[] = [
    {
      key: "payment_code",
      header: "결제코드",
      width: "130px",
      render: (p) => (
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
          {p.payment_code}
        </span>
      ),
    },
    {
      key: "member",
      header: "후원자",
      render: (p) => p.members?.name ?? "-",
    },
    {
      key: "campaign",
      header: "캠페인",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">{p.campaigns?.title ?? "-"}</span>
      ),
    },
    {
      key: "amount",
      header: "금액",
      align: "right",
      width: "120px",
      render: (p) => (
        <span className="font-medium text-[var(--text)]">{formatAmount(p.amount)}</span>
      ),
    },
    {
      key: "pay_date",
      header: "결제일",
      width: "110px",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">{formatDate(p.pay_date)}</span>
      ),
    },
    {
      key: "pay_status",
      header: "납부상태",
      width: "80px",
      render: (p) => <PayStatusBadge status={p.pay_status} />,
    },
    {
      key: "income_status",
      header: "수입상태",
      width: "90px",
      render: (p) => <IncomeStatusBadge status={p.income_status} />,
    },
  ];

  const batchUpdateIncome = async (incomeStatus: IncomeStatus) => {
    if (selected.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await fetch("/api/admin/payments/income-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIds: Array.from(selected),
          incomeStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data?.error ?? "변경 실패");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div>
      <AddPaymentDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); router.refresh(); }}
      />

      <RefundDialog
        payment={refundTarget}
        onClose={() => setRefundTarget(null)}
        onRefunded={() => { setRefundTarget(null); router.refresh(); }}
      />

      <PageHeader
        title="납입 관리"
        description={`총 ${total.toLocaleString("ko-KR")}건`}
        stats={
          <>
            <StatCard label="당월 수납" value={formatKRW(stats.monthPaidTotal)} />
            <StatCard
              label="미납/실패"
              value={`${stats.unpaidCount}건`}
              tone={stats.unpaidCount > 0 ? "negative" : "default"}
            />
            <StatCard
              label="CMS 성공률"
              value={`${stats.cmsSuccessRate}%`}
              tone={stats.cmsSuccessRate < 90 ? "warning" : "default"}
            />
            <StatCard label="수입대기" value={`${stats.pendingIncomeCount}건`} />
          </>
        }
        actions={
          <>
            <a
              href={`/api/admin/export/payments${
                initialStatus && initialStatus !== "all" ? `?status=${initialStatus}` : ""
              }`}
              className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface)]"
            >
              CSV 내보내기
            </a>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
            >
              + 납입 등록
            </Button>
          </>
        }
        tabs={pageTabs}
        activeTab={initialStatus}
      />

      <FilterBar
        searchPlaceholder="이름 / 결제코드 / 캠페인"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={
          <>
            {campaignOptions.length > 0 && (
              <FilterDropdown
                label="캠페인"
                value={campaignFilter}
                options={campaignOptions}
                onChange={setCampaignFilter}
              />
            )}
            {methodOptions.length > 0 && (
              <FilterDropdown
                label="결제수단"
                value={methodFilter}
                options={methodOptions}
                onChange={setMethodFilter}
              />
            )}
          </>
        }
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      {/* 일괄 수입상태 변경 바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-3 rounded-lg border border-[var(--accent)] bg-[rgba(99,102,241,0.05)]">
          <span className="text-sm font-medium text-[var(--text)]">
            {selected.size}건 선택
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">→ 수입상태:</span>
          {(["pending", "processing", "confirmed", "excluded"] as IncomeStatus[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                disabled={batchLoading}
                onClick={() => batchUpdateIncome(s)}
                className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50"
              >
                {INCOME_STATUS_LABEL[s]}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
          >
            선택 해제
          </button>
        </div>
      )}

      <DataTable<PaymentWithRelations>
        columns={columns}
        rows={filteredPayments}
        rowKey={(p) => p.id}
        emptyMessage="납입 내역이 없습니다."
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        onRowClick={(p) => setDetailTarget(p)}
        rowActions={(p) =>
          p.pay_status === "paid" && p.toss_payment_key ? (
            <button
              type="button"
              onClick={() => setRefundTarget(p)}
              className="rounded border border-[var(--negative)] px-2 py-0.5 text-[11px] text-[var(--negative)] hover:bg-[var(--negative-soft)]"
            >
              환불
            </button>
          ) : null
        }
      />

      <DetailDrawer
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? `납입 상세 · ${detailTarget.payment_code}` : ""}
        subtitle={
          detailTarget
            ? `${detailTarget.members?.name ?? "-"} · ${formatAmount(detailTarget.amount)}`
            : undefined
        }
      >
        {detailTarget && (
          <div className="flex flex-col gap-4 text-[13px]">
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                결제 정보
              </h3>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
                <dt className="text-[var(--muted-foreground)]">결제일</dt>
                <dd className="text-[var(--text)]">{formatDate(detailTarget.pay_date)}</dd>
                <dt className="text-[var(--muted-foreground)]">결제수단</dt>
                <dd className="text-[var(--text)]">{detailTarget.pg_method ?? "-"}</dd>
                <dt className="text-[var(--muted-foreground)]">캠페인</dt>
                <dd className="text-[var(--text)]">{detailTarget.campaigns?.title ?? "-"}</dd>
                <dt className="text-[var(--muted-foreground)]">납부상태</dt>
                <dd><PayStatusBadge status={detailTarget.pay_status} /></dd>
                <dt className="text-[var(--muted-foreground)]">수입상태</dt>
                <dd><IncomeStatusBadge status={detailTarget.income_status} /></dd>
              </dl>
            </section>

            {detailTarget.fail_reason && (
              <section>
                <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                  실패 사유
                </h3>
                <div className="rounded border border-[var(--negative)] bg-[var(--negative-soft)] p-3 text-[var(--negative)]">
                  {detailTarget.fail_reason}
                </div>
              </section>
            )}

            {detailTarget.pay_status === "refunded" && (
              <section>
                <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                  환불 내역
                </h3>
                <div className="rounded border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[var(--text)]">
                  {detailTarget.refund_amount != null
                    ? `부분환불 ${formatAmount(detailTarget.refund_amount)}`
                    : "전액환불"}
                  {detailTarget.cancel_reason && (
                    <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                      사유: {detailTarget.cancel_reason}
                    </div>
                  )}
                  {detailTarget.cancelled_at && (
                    <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                      처리 시각: {new Date(detailTarget.cancelled_at).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
