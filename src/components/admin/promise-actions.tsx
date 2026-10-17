"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PromiseWithRelations } from "@/types/promise";
import { formatKRW as formatAmount } from "@/lib/format";

/** 정기후원 목록의 행 동작(금액 변경·일시중지·해지·재개·완료)과 그 메뉴 */

// ── Action dialog types ──────────────────────────────────────────────────────

export type ActionType = "amount" | "suspend" | "cancel" | "resume" | "complete" | "consent";

export type ActiveAction = {
  promise: PromiseWithRelations;
  action: ActionType;
};

// ── Amount change dialog ─────────────────────────────────────────────────────

export function AmountDialog({
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
          {loading ? "저장 중…" : "변경"}
        </Button>
      </div>
    </form>
  );
}

// ── Suspend dialog ────────────────────────────────────────────────────────────

export function SuspendDialog({
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
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 정기후원을 일시정지합니다.
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
          {loading ? "처리 중…" : "일시정지"}
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
  "중복 신청",
  "기관 사정",
  "기타",
];

export function CancelDialog({
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
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 정기후원을 해지합니다. 이 작업은 되돌릴 수 없습니다.
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
          {loading ? "처리 중…" : "해지 확인"}
        </Button>
      </div>
    </form>
  );
}

// ── Resume / Complete confirm dialogs ────────────────────────────────────────

export function ConfirmActionDialog({
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
        <strong style={{ color: "var(--text)" }}>{promise.members?.name}</strong>님의 정기후원을{" "}
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
          {loading ? "처리 중…" : label}
        </Button>
      </div>
    </form>
  );
}

// ── Action menu per row ───────────────────────────────────────────────────────

export function ActionMenu({
  promise,
  onAction,
}: {
  promise: PromiseWithRelations;
  onAction: (p: PromiseWithRelations, a: ActionType) => void;
}) {
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
  // 자동이체 — 출금동의 기록(등록 대기 약정은 기록하면 진행 중이 된다)
  if (promise.pay_method === "cms" && (status === "pending_billing" || status === "active" || status === "suspended")) {
    actions.unshift({ key: "consent", label: status === "pending_billing" ? "출금동의 기록 후 시작" : "출금동의 기록" });
  }

  if (actions.length === 0) return null;

  // 행 클릭(상세 열기)으로 번지는 것은 DataTable 의 rowActions 칸이 막아 준다(포털 안 클릭도 React 트리로 올라감).
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="정기후원 작업"
        className="rounded px-2 py-1 text-xs border transition-colors"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        ···
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="isolate z-50">
          <Menu.Popup
            className="rounded-lg border shadow-lg py-1 outline-none"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              minWidth: "8rem",
            }}
          >
            {actions.map((a) => (
              <Menu.Item
                key={a.key}
                onClick={() => onAction(promise, a.key)}
                className="w-full cursor-default text-left px-3 py-1.5 text-sm outline-none data-highlighted:bg-[var(--surface-2)]"
                style={{ color: a.color ?? "var(--text)" }}
              >
                {a.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
