"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PayStatus, PaymentWithRelations } from "@/types/payment";

type Props = {
  payments: PaymentWithRelations[];
  total: number;
  initialStatus: string;
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
  paid: "bg-[rgba(34,197,94,0.15)] text-[var(--positive)]",
  pending: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  unpaid: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  failed: "bg-[rgba(239,68,68,0.15)] text-[var(--negative)]",
  cancelled: "bg-[rgba(239,68,68,0.15)] text-[var(--negative)]",
  refunded: "bg-[rgba(245,158,11,0.15)] text-[var(--warning)]",
};

function PayStatusBadge({ status }: { status: PayStatus }) {
  return (
    <Badge className={`border-0 font-medium ${PAY_STATUS_CLASS[status]}`}>
      {PAY_STATUS_LABEL[status]}
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

export function PaymentList({ payments, total, initialStatus }: Props) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const selectStatus = (next: string) => {
    const params = new URLSearchParams();
    if (next && next !== "all") params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `/admin/payments?${qs}` : "/admin/payments");
  };

  return (
    <div>
      <AddPaymentDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); router.refresh(); }}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">납입 관리</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            총 {total.toLocaleString("ko-KR")}건
          </span>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-[var(--accent)] text-white text-sm px-4 py-1.5 h-auto"
          >
            + 납입 등록
          </Button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {STATUS_TABS.map((tab) => {
          const isActive = initialStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => selectStatus(tab.value)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                isActive
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--border)]">
              <TableHead className="text-[var(--muted-foreground)]">결제코드</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">후원자</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">캠페인</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">금액</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">결제일</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">상태</TableHead>
              <TableHead className="text-[var(--muted-foreground)]">결제방법</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-[var(--muted-foreground)]"
                >
                  납입 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  className={`border-[var(--border)] ${p.receipt_url ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (p.receipt_url) window.open(p.receipt_url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <TableCell className="font-mono text-sm text-[var(--muted-foreground)]">
                    {p.payment_code}
                  </TableCell>
                  <TableCell className="text-[var(--text)]">
                    {p.members?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--muted-foreground)]">
                    {p.campaigns?.title ?? "-"}
                  </TableCell>
                  <TableCell className="font-medium text-[var(--text)]">
                    {formatAmount(p.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--muted-foreground)]">
                    {formatDate(p.pay_date)}
                  </TableCell>
                  <TableCell>
                    <PayStatusBadge status={p.pay_status} />
                  </TableCell>
                  <TableCell className="text-sm text-[var(--muted-foreground)]">
                    {p.pg_method ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
