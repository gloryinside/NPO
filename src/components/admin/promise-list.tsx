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
import type {
  PromiseStatus,
  PromiseType,
  PromiseWithRelations,
} from "@/types/promise";

type Props = {
  promises: PromiseWithRelations[];
  total: number;
  initialStatus: string;
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "active", label: "진행중" },
  { value: "suspended", label: "일시중지" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "해지" },
  { value: "all", label: "전체" },
];

const STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "rgba(34,197,94,0.15)", color: "var(--positive)" },
    suspended: { background: "rgba(245,158,11,0.15)", color: "var(--warning)" },
    cancelled: { background: "rgba(239,68,68,0.15)", color: "var(--negative)" },
    completed: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseTypeBadge({ type }: { type: PromiseType }) {
  const styles: Record<PromiseType, React.CSSProperties> = {
    regular: { background: "rgba(56,189,248,0.15)", color: "var(--info)" },
    onetime: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
  };
  return (
    <Badge style={styles[type]} className="border-0 font-medium">
      {TYPE_LABEL[type]}
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

type NewPromiseForm = {
  memberId: string;
  memberName: string;
  campaignId: string;
  campaignName: string;
  type: "regular" | "onetime";
  amount: string;
  payDay: string;
  payMethod: string;
  startedAt: string;
};

const EMPTY_PROMISE: NewPromiseForm = {
  memberId: "",
  memberName: "",
  campaignId: "",
  campaignName: "",
  type: "regular",
  amount: "",
  payDay: "",
  payMethod: "card",
  startedAt: new Date().toISOString().slice(0, 10),
};

function AddPromiseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewPromiseForm>(EMPTY_PROMISE);
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
    if (!form.campaignId) { setError("캠페인을 선택해주세요."); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError("금액을 입력해주세요."); return; }
    if (form.type === "regular" && !form.payDay) { setError("정기 약정은 납입일을 입력해주세요."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: form.memberId,
          campaignId: form.campaignId,
          type: form.type,
          amount,
          payDay: form.type === "regular" ? Number(form.payDay) : null,
          payMethod: form.payMethod,
          startedAt: form.startedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "약정 생성 실패");
      setForm(EMPTY_PROMISE);
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
      <DialogContent className="max-w-lg bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">약정 생성</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* 후원자 검색 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="promise-member" className="text-sm font-medium text-[var(--text)]">
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
                  id="promise-member"
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

          {/* 캠페인 검색 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="promise-campaign" className="text-sm font-medium text-[var(--text)]">
              캠페인 <span className="text-[var(--negative)]">*</span>
            </label>
            {form.campaignId ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-[var(--surface-2)] border-[var(--border)]">
                <span className="text-sm text-[var(--text)] flex-1">{form.campaignName}</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, campaignId: "", campaignName: "" }))}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
                >
                  변경
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="promise-campaign"
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
              <label htmlFor="promise-type" className="text-sm font-medium text-[var(--text)]">유형</label>
              <select
                id="promise-type"
                title="약정 유형"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "regular" | "onetime" }))}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
              >
                <option value="regular">정기</option>
                <option value="onetime">일시</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-amount" className="text-sm font-medium text-[var(--text)]">
                금액(원) <span className="text-[var(--negative)]">*</span>
              </label>
              <Input
                id="promise-amount"
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="30000"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.type === "regular" && (
              <div className="flex flex-col gap-1">
                <label htmlFor="promise-payday" className="text-sm font-medium text-[var(--text)]">
                  납입일 <span className="text-[var(--negative)]">*</span>
                </label>
                <Input
                  id="promise-payday"
                  type="number"
                  min={1}
                  max={28}
                  value={form.payDay}
                  onChange={(e) => setForm((p) => ({ ...p, payDay: e.target.value }))}
                  placeholder="매월 (1~28)"
                  className={inputCls}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-method" className="text-sm font-medium text-[var(--text)]">결제 방법</label>
              <select
                id="promise-method"
                title="결제 방법"
                value={form.payMethod}
                onChange={(e) => setForm((p) => ({ ...p, payMethod: e.target.value }))}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
              >
                <option value="card">카드</option>
                <option value="transfer">계좌이체</option>
                <option value="cms">CMS</option>
                <option value="manual">수기</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-start" className="text-sm font-medium text-[var(--text)]">시작일</label>
              <Input
                id="promise-start"
                type="date"
                value={form.startedAt}
                onChange={(e) => setForm((p) => ({ ...p, startedAt: e.target.value }))}
                className={inputCls}
              />
            </div>
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
              {saving ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PromiseList({ promises, total, initialStatus }: Props) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const selectStatus = (next: string) => {
    const params = new URLSearchParams();
    if (next && next !== "active") params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `/admin/promises?${qs}` : "/admin/promises");
  };

  return (
    <div>
      <AddPromiseDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); router.refresh(); }}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">약정 관리</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            총 {total.toLocaleString("ko-KR")}건
          </span>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-[var(--accent)] text-white text-sm px-4 py-1.5 h-auto"
          >
            + 약정 생성
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
              className="px-3 py-1.5 text-sm rounded-md border transition-colors"
              style={{
                background: isActive ? "var(--accent)" : "var(--surface-2)",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                color: isActive ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--border)" }}>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                약정코드
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                후원자
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                캠페인
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                유형
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                금액
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                납입일
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                시작일
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                상태
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promises.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  약정 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              promises.map((p) => (
                <TableRow
                  key={p.id}
                  style={{
                    borderColor: "var(--border)",
                    cursor: p.member_id ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (p.member_id) {
                      router.push(`/admin/members/${p.member_id}`);
                    }
                  }}
                >
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.promise_code}
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    {p.members?.name ?? "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.campaigns?.title ?? "-"}
                  </TableCell>
                  <TableCell>
                    <PromiseTypeBadge type={p.type} />
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {formatAmount(p.amount)}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(p.started_at)}
                  </TableCell>
                  <TableCell>
                    <PromiseStatusBadge status={p.status} />
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
