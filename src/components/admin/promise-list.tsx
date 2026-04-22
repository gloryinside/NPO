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
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/common/data-table";
import { DetailDrawer } from "@/components/common/detail-drawer";
import {
  FilterBar,
  FilterDropdown,
} from "@/components/common/filter-bar";
import type {
  PromiseStatus,
  PromiseType,
  PromiseWithRelations,
} from "@/types/promise";

type Props = {
  promises: PromiseWithRelations[];
  total: number;
  initialStatus: string;
  stats: {
    activeCount: number;
    cancelScheduledCount: number;
    overdueCount: number;
  };
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
  pending_billing: "결제수단 대기",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "var(--positive-soft)", color: "var(--positive)" },
    suspended: { background: "var(--warning-soft)", color: "var(--warning)" },
    cancelled: { background: "var(--negative-soft)", color: "var(--negative)" },
    completed: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    pending_billing: { background: "var(--warning-soft)", color: "var(--warning)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseTypeBadge({ type }: { type: PromiseType }) {
  const styles: Record<PromiseType, React.CSSProperties> = {
    regular: { background: "var(--info-soft)", color: "var(--info)" },
    onetime: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
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
  try { return new Date(value).toLocaleDateString("ko-KR"); } catch { return value; }
}

// ── Action dialog types ──────────────────────────────────────────────────────

type ActionType = "amount" | "suspend" | "cancel" | "resume" | "complete";

type ActiveAction = {
  promise: PromiseWithRelations;
  action: ActionType;
};

// ── Amount change dialog ─────────────────────────────────────────────────────

function AmountDialog({
  promise,
  onClose,
  onDone,
}: {
  promise: PromiseWithRelations;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(promise.amount ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) { setError("유효한 금액을 입력해주세요."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promises/${promise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--text)]">
          새 후원 금액 (원) <span style={{ color: "var(--negative)" }}>*</span>
        </label>
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
          autoFocus
        />
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          현재: {formatAmount(promise.amount)}
        </p>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">
          취소
        </Button>
        <Button type="submit" disabled={loading}
          className="bg-[var(--accent)] text-white disabled:opacity-60">
          {loading ? "저장 중..." : "변경"}
        </Button>
      </div>
    </form>
  );
}

// ── Suspend dialog ────────────────────────────────────────────────────────────

function SuspendDialog({
  promise,
  onClose,
  onDone,
}: {
  promise: PromiseWithRelations;
  onClose: () => void;
  onDone: () => void;
}) {
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promises/${promise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "suspended",
          suspendedUntil: suspendedUntil || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 약정을 일시정지합니다.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--text)]">재개 예정일 (선택)</label>
        <Input
          type="date"
          value={suspendedUntil}
          onChange={(e) => setSuspendedUntil(e.target.value)}
          className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
        />
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          비워두면 수동으로 재개하기 전까지 유지됩니다.
        </p>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">
          취소
        </Button>
        <Button type="submit" disabled={loading}
          style={{ background: "var(--warning)", color: "#fff" }}>
          {loading ? "처리 중..." : "일시정지"}
        </Button>
      </div>
    </form>
  );
}

// ── Cancel dialog ─────────────────────────────────────────────────────────────

const CANCEL_REASONS = [
  "개인 사정",
  "경제적 어려움",
  "연락 두절",
  "중복 약정",
  "기관 사정",
  "기타",
];

function CancelDialog({
  promise,
  onClose,
  onDone,
}: {
  promise: PromiseWithRelations;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalReason = reason === "기타" ? (customReason.trim() || "기타") : reason;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promises/${promise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancelReason: finalReason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 약정을 해지합니다. 이 작업은 되돌릴 수 없습니다.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--text)]">해지 사유</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          title="해지 사유"
          className="rounded-lg border px-3 py-2 text-sm outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
        >
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      {reason === "기타" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text)]">직접 입력</label>
          <Input
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="해지 사유를 입력해주세요"
            className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
          />
        </div>
      )}
      {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">
          취소
        </Button>
        <Button type="submit" disabled={loading}
          style={{ background: "var(--negative)", color: "#fff" }}>
          {loading ? "처리 중..." : "해지 확인"}
        </Button>
      </div>
    </form>
  );
}

// ── Resume / Complete confirm dialogs ────────────────────────────────────────

function ConfirmActionDialog({
  promise,
  action,
  onClose,
  onDone,
}: {
  promise: PromiseWithRelations;
  action: "resume" | "complete";
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResume = action === "resume";
  const label = isResume ? "재개" : "완료 처리";
  const newStatus = isResume ? "active" : "completed";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promises/${promise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 약정을{" "}
        <strong style={{ color: "var(--text)" }}>{label}</strong>
        {isResume ? "합니다." : " 처리합니다."}
      </p>
      {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">
          취소
        </Button>
        <Button type="submit" disabled={loading}
          className="bg-[var(--accent)] text-white disabled:opacity-60">
          {loading ? "처리 중..." : label}
        </Button>
      </div>
    </form>
  );
}

// ── Action menu per row ───────────────────────────────────────────────────────

function ActionMenu({
  promise,
  onAction,
}: {
  promise: PromiseWithRelations;
  onAction: (p: PromiseWithRelations, a: ActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = promise.status;

  const actions: Array<{ key: ActionType; label: string; color?: string }> = [];
  if (status === "active" || status === "suspended") {
    actions.push({ key: "amount", label: "금액 변경" });
  }
  if (status === "active") {
    actions.push({ key: "suspend", label: "일시정지", color: "var(--warning)" });
    actions.push({ key: "complete", label: "완료 처리", color: "var(--muted-foreground)" });
    actions.push({ key: "cancel", label: "해지", color: "var(--negative)" });
  }
  if (status === "suspended") {
    actions.push({ key: "resume", label: "재개", color: "var(--positive)" });
    actions.push({ key: "cancel", label: "해지", color: "var(--negative)" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="relative" style={{ display: "inline-block" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded px-2 py-1 text-xs border transition-colors"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        ···
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute right-0 z-20 mt-1 rounded-lg border shadow-lg py-1"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              minWidth: "8rem",
            }}
          >
            {actions.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onAction(promise, a.key);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                  style={{ color: a.color ?? "var(--text)" }}
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Add promise dialog ────────────────────────────────────────────────────────

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
  const [memberResults, setMemberResults] = useState<{ id: string; name: string; member_code: string }[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignResults, setCampaignResults] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchMembers(q: string) {
    if (!q.trim()) { setMemberResults([]); return; }
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json() as { members?: { id: string; name: string; member_code: string }[] };
    setMemberResults(data.members ?? []);
  }

  async function searchCampaigns(q: string) {
    if (!q.trim()) { setCampaignResults([]); return; }
    const res = await fetch(`/api/admin/campaigns?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json() as { campaigns?: { id: string; title: string }[] };
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
      const data = await res.json() as { error?: string };
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
              후원자 <span style={{ color: "var(--negative)" }}>*</span>
            </label>
            {form.memberId ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-[var(--surface-2)] border-[var(--border)]">
                <span className="text-sm text-[var(--text)] flex-1">{form.memberName}</span>
                <button type="button"
                  onClick={() => setForm((p) => ({ ...p, memberId: "", memberName: "" }))}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]">변경</button>
              </div>
            ) : (
              <div className="relative">
                <Input id="promise-member" value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
                  placeholder="이름으로 검색" className={inputCls} />
                {memberResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-lg border bg-[var(--surface)] border-[var(--border)] shadow-lg max-h-40 overflow-y-auto">
                    {memberResults.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => {
                          setForm((p) => ({ ...p, memberId: m.id, memberName: `${m.name} (${m.member_code})` }));
                          setMemberSearch(""); setMemberResults([]);
                        }} className="w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
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
              캠페인 <span style={{ color: "var(--negative)" }}>*</span>
            </label>
            {form.campaignId ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-[var(--surface-2)] border-[var(--border)]">
                <span className="text-sm text-[var(--text)] flex-1">{form.campaignName}</span>
                <button type="button"
                  onClick={() => setForm((p) => ({ ...p, campaignId: "", campaignName: "" }))}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]">변경</button>
              </div>
            ) : (
              <div className="relative">
                <Input id="promise-campaign" value={campaignSearch}
                  onChange={(e) => { setCampaignSearch(e.target.value); searchCampaigns(e.target.value); }}
                  placeholder="캠페인 이름으로 검색" className={inputCls} />
                {campaignResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-lg border bg-[var(--surface)] border-[var(--border)] shadow-lg max-h-40 overflow-y-auto">
                    {campaignResults.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => {
                          setForm((p) => ({ ...p, campaignId: c.id, campaignName: c.title }));
                          setCampaignSearch(""); setCampaignResults([]);
                        }} className="w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
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
              <select id="promise-type" title="약정 유형" value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "regular" | "onetime" }))}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}>
                <option value="regular">정기</option>
                <option value="onetime">일시</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-amount" className="text-sm font-medium text-[var(--text)]">
                금액(원) <span style={{ color: "var(--negative)" }}>*</span>
              </label>
              <Input id="promise-amount" type="number" min={1} value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="30000" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.type === "regular" && (
              <div className="flex flex-col gap-1">
                <label htmlFor="promise-payday" className="text-sm font-medium text-[var(--text)]">
                  납입일 <span style={{ color: "var(--negative)" }}>*</span>
                </label>
                <Input id="promise-payday" type="number" min={1} max={28} value={form.payDay}
                  onChange={(e) => setForm((p) => ({ ...p, payDay: e.target.value }))}
                  placeholder="매월 (1~28)" className={inputCls} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-method" className="text-sm font-medium text-[var(--text)]">결제 방법</label>
              <select id="promise-method" title="결제 방법" value={form.payMethod}
                onChange={(e) => setForm((p) => ({ ...p, payMethod: e.target.value }))}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}>
                <option value="card">카드</option>
                <option value="transfer">계좌이체</option>
                <option value="cms">CMS</option>
                <option value="manual">수기</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="promise-start" className="text-sm font-medium text-[var(--text)]">시작일</label>
              <Input id="promise-start" type="date" value={form.startedAt}
                onChange={(e) => setForm((p) => ({ ...p, startedAt: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          {error && (
            <p className="text-sm rounded-lg border px-3 py-2"
              style={{ color: "var(--negative)", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.4)" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]">취소</Button>
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

// ── Main component ────────────────────────────────────────────────────────────

export function PromiseList({ promises, total, initialStatus, stats }: Props) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [active, setActive] = useState<ActiveAction | null>(null);
  const [detailTarget, setDetailTarget] = useState<PromiseWithRelations | null>(null);

  // FilterBar state (client-side narrowing on top of server-filtered list)
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PromiseType | null>(null);

  const filteredPromises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return promises.filter((p) => {
      if (q) {
        const name = (p.members?.name ?? "").toLowerCase();
        const code = (p.promise_code ?? "").toLowerCase();
        const campaign = (p.campaigns?.title ?? "").toLowerCase();
        const memberCode = (p.members?.member_code ?? "").toLowerCase();
        if (
          !name.includes(q) &&
          !code.includes(q) &&
          !campaign.includes(q) &&
          !memberCode.includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter && p.type !== typeFilter) return false;
      return true;
    });
  }, [promises, searchQuery, typeFilter]);

  const hasActiveFilters = !!(searchQuery || typeFilter);
  function resetFilters() {
    setSearchQuery("");
    setTypeFilter(null);
  }

  const openAction = (promise: PromiseWithRelations, action: ActionType) => {
    setActive({ promise, action });
  };

  const closeAction = () => setActive(null);

  const doneAction = () => {
    setActive(null);
    setDetailTarget(null);
    router.refresh();
  };

  const dialogTitle: Record<ActionType, string> = {
    amount: "후원 금액 변경",
    suspend: "약정 일시정지",
    cancel: "약정 해지",
    resume: "약정 재개",
    complete: "약정 완료 처리",
  };

  const columns: DataTableColumn<PromiseWithRelations>[] = [
    {
      key: "promise_code",
      header: "약정코드",
      width: "140px",
      render: (p) => (
        <span className="font-mono text-[12px] text-[var(--muted-foreground)]">
          {p.promise_code}
        </span>
      ),
    },
    {
      key: "member",
      header: "후원자",
      render: (p) => (
        <span className="text-[var(--text)]">{p.members?.name ?? "-"}</span>
      ),
    },
    {
      key: "campaign",
      header: "캠페인",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {p.campaigns?.title ?? "-"}
        </span>
      ),
    },
    {
      key: "type",
      header: "유형",
      width: "70px",
      render: (p) => <PromiseTypeBadge type={p.type} />,
    },
    {
      key: "amount",
      header: "금액",
      align: "right",
      width: "120px",
      render: (p) => (
        <span className="font-medium text-[var(--text)]">
          {formatAmount(p.amount)}
        </span>
      ),
    },
    {
      key: "pay_day",
      header: "납입일",
      width: "100px",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
        </span>
      ),
    },
    {
      key: "started_at",
      header: "시작일",
      width: "110px",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {formatDate(p.started_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      width: "100px",
      render: (p) => <PromiseStatusBadge status={p.status} />,
    },
  ];

  const pageTabs = STATUS_TABS.map((tab) => ({
    key: tab.value,
    label: tab.label,
    href:
      tab.value === "active"
        ? "/admin/promises"
        : `/admin/promises?status=${tab.value}`,
  }));

  const activeTabKey = initialStatus || "active";

  return (
    <div>
      <AddPromiseDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); router.refresh(); }}
      />

      {/* Action dialog */}
      <Dialog open={active !== null} onOpenChange={(v) => { if (!v) closeAction(); }}>
        {active && (
          <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
            <DialogHeader>
              <DialogTitle className="text-[var(--text)]">
                {dialogTitle[active.action]}
              </DialogTitle>
            </DialogHeader>
            {active.action === "amount" && (
              <AmountDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {active.action === "suspend" && (
              <SuspendDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {active.action === "cancel" && (
              <CancelDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {(active.action === "resume" || active.action === "complete") && (
              <ConfirmActionDialog
                promise={active.promise}
                action={active.action}
                onClose={closeAction}
                onDone={doneAction}
              />
            )}
          </DialogContent>
        )}
      </Dialog>

      <PageHeader
        title="약정 관리"
        description={`정기/일시 후원 약정을 확인하고 관리합니다. 총 ${total.toLocaleString(
          "ko-KR"
        )}건`}
        stats={
          <>
            <StatCard
              label="활성 약정"
              value={`${stats.activeCount.toLocaleString("ko-KR")}건`}
            />
            <StatCard
              label="해지 예정"
              value={`${stats.cancelScheduledCount.toLocaleString("ko-KR")}건`}
              tone={stats.cancelScheduledCount > 0 ? "warning" : "default"}
            />
            <StatCard
              label="연체"
              value={`${stats.overdueCount.toLocaleString("ko-KR")}건`}
              tone={stats.overdueCount > 0 ? "negative" : "default"}
            />
          </>
        }
        actions={
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
          >
            + 약정 등록
          </Button>
        }
        tabs={pageTabs}
        activeTab={activeTabKey}
      />

      <FilterBar
        searchPlaceholder="후원자/약정코드/캠페인 검색"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={
          <FilterDropdown<PromiseType>
            label="유형"
            value={typeFilter}
            options={[
              { value: "regular", label: "정기" },
              { value: "onetime", label: "일시" },
            ]}
            onChange={setTypeFilter}
          />
        }
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      <DataTable
        columns={columns}
        rows={filteredPromises}
        rowKey={(p) => p.id}
        emptyMessage="약정 내역이 없습니다."
        onRowClick={(p) => setDetailTarget(p)}
        rowActions={(p) => <ActionMenu promise={p} onAction={openAction} />}
      />

      <DetailDrawer
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="약정 상세"
        subtitle={
          detailTarget
            ? `${detailTarget.members?.name ?? "-"} · ${formatAmount(
                detailTarget.amount
              )}`
            : undefined
        }
        footer={
          detailTarget && detailTarget.member_id ? (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (detailTarget.member_id) {
                    router.push(`/admin/members/${detailTarget.member_id}`);
                  }
                }}
                className="h-auto bg-[var(--accent)] px-3 py-1.5 text-[12px] text-white"
              >
                후원자 프로필 열기
              </Button>
            </div>
          ) : undefined
        }
      >
        {detailTarget && (
          <div className="flex flex-col gap-4 text-[13px]">
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                약정 정보
              </h3>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
                <dt className="text-[var(--muted-foreground)]">약정코드</dt>
                <dd className="font-mono text-[12px] text-[var(--text)]">
                  {detailTarget.promise_code}
                </dd>
                <dt className="text-[var(--muted-foreground)]">후원자</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.members?.name ?? "-"}
                  {detailTarget.members?.member_code && (
                    <span className="ml-1 text-[11px] text-[var(--muted-foreground)]">
                      ({detailTarget.members.member_code})
                    </span>
                  )}
                </dd>
                <dt className="text-[var(--muted-foreground)]">캠페인</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.campaigns?.title ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">유형</dt>
                <dd>
                  <PromiseTypeBadge type={detailTarget.type} />
                </dd>
                <dt className="text-[var(--muted-foreground)]">금액</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {formatAmount(detailTarget.amount)}
                </dd>
                <dt className="text-[var(--muted-foreground)]">납입일</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.pay_day ? `매월 ${detailTarget.pay_day}일` : "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">결제수단</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.pay_method ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">상태</dt>
                <dd>
                  <PromiseStatusBadge status={detailTarget.status} />
                </dd>
                {detailTarget.started_at && (
                  <>
                    <dt className="text-[var(--muted-foreground)]">시작일</dt>
                    <dd className="text-[var(--text)]">
                      {formatDate(detailTarget.started_at)}
                    </dd>
                  </>
                )}
                {detailTarget.ended_at && (
                  <>
                    <dt className="text-[var(--muted-foreground)]">종료일</dt>
                    <dd className="text-[var(--text)]">
                      {formatDate(detailTarget.ended_at)}
                    </dd>
                  </>
                )}
              </dl>
            </section>

            <section className="border-t border-[var(--border)] pt-3">
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                빠른 작업
              </h3>
              <div className="flex flex-wrap gap-2">
                {(detailTarget.status === "active" ||
                  detailTarget.status === "suspended") && (
                  <button
                    type="button"
                    onClick={() => openAction(detailTarget, "amount")}
                    className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--text)] hover:bg-[var(--surface)]"
                  >
                    금액 변경
                  </button>
                )}
                {detailTarget.status === "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "suspend")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--warning)" }}
                    >
                      일시정지
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "complete")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--surface)]"
                    >
                      완료 처리
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "cancel")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--negative)" }}
                    >
                      해지
                    </button>
                  </>
                )}
                {detailTarget.status === "suspended" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "resume")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--positive)" }}
                    >
                      재개
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "cancel")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--negative)" }}
                    >
                      해지
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
