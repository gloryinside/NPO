"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PromiseStatus, PromiseType } from "@/types/promise";

type CampaignRef = { id: string; title: string } | null;

type DonorPromise = {
  id: string;
  promise_code: string;
  status: PromiseStatus;
  type: PromiseType;
  amount: number | null;
  pay_day: number | null;
  started_at: string | null;
  ended_at: string | null;
  campaigns: CampaignRef;
};

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

const STATUS_BADGE_CLS: Record<PromiseStatus, string> = {
  active: "bg-[rgba(34,197,94,0.15)] text-[var(--positive)]",
  suspended: "bg-[rgba(245,158,11,0.15)] text-[var(--warning)]",
  cancelled: "bg-[rgba(239,68,68,0.15)] text-[var(--negative)]",
  completed: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
};

const STATUS_ORDER: PromiseStatus[] = [
  "active",
  "suspended",
  "completed",
  "cancelled",
];

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

type AmountDialogState = { open: true; promise: DonorPromise } | { open: false };

export default function DonorPromisesPage() {
  const [promises, setPromises] = useState<DonorPromise[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [amountDialog, setAmountDialog] = useState<AmountDialogState>({ open: false });
  const [amountInput, setAmountInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  const fetchPromises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/donor/promises");
      if (!res.ok) return;
      const data = await res.json();
      const all = (data.promises ?? []) as DonorPromise[];
      const sorted = [...all].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      );
      setPromises(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromises();
  }, [fetchPromises]);

  async function handleAction(id: string, action: "suspend" | "cancel" | "resume") {
    const label = action === "cancel" ? "해지" : action === "resume" ? "재개" : "일시중지";
    if (!confirm(`약정을 ${label}하시겠습니까?`)) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/donor/promises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.code === "BILLING_KEY_MISSING") {
          alert("결제 수단이 등록되지 않아 재개할 수 없습니다.\n관리자에게 카드 재등록을 요청해주세요.");
        } else {
          alert(data.error ?? "처리 중 오류가 발생했습니다.");
        }
        return;
      }
      await fetchPromises();
    } finally {
      setActioning(null);
    }
  }

  function openAmountDialog(p: DonorPromise) {
    setAmountInput(p.amount != null ? String(p.amount) : "");
    setAmountError(null);
    setAmountDialog({ open: true, promise: p });
  }

  async function handleAmountChange() {
    if (!amountDialog.open) return;
    const id = amountDialog.promise.id;
    const num = Number(amountInput);
    if (!Number.isFinite(num) || num <= 0) {
      setAmountError("유효한 금액을 입력하세요.");
      return;
    }
    setActioning(id);
    setAmountError(null);
    try {
      const res = await fetch(`/api/donor/promises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changeAmount", amount: num }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAmountError(data.error ?? "처리 중 오류가 발생했습니다.");
        return;
      }
      setAmountDialog({ open: false });
      await fetchPromises();
    } finally {
      setActioning(null);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[var(--muted-foreground)]">
        불러오는 중...
      </div>
    );
  }

  const inputStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  return (
    <>
    <Dialog
      open={amountDialog.open}
      onOpenChange={(o) => { if (!o) setAmountDialog({ open: false }); }}
    >
      <DialogContent
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text)" }}>후원 금액 변경</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-amount" style={{ color: "var(--text)" }}>
              새 후원 금액 (원)
            </Label>
            <Input
              id="new-amount"
              type="number"
              min={1}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="50000"
              style={inputStyle}
            />
          </div>
          {amountError && (
            <p className="text-sm" style={{ color: "var(--negative)" }}>
              {amountError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setAmountDialog({ open: false })}
              style={{ color: "var(--muted-foreground)" }}
            >
              취소
            </Button>
            <Button
              disabled={amountDialog.open && actioning === amountDialog.promise.id}
              onClick={handleAmountChange}
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              변경
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text)]">내 약정</h1>
        <div className="text-sm text-[var(--muted-foreground)]">
          총 {promises.length.toLocaleString("ko-KR")}건
        </div>
      </div>

      {promises.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--muted-foreground)]">
          등록된 약정이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {promises.map((p) => {
            const isActive = p.status === "active";
            const isSuspended = p.status === "suspended";
            const canAct = isActive || isSuspended;

            return (
              <div
                key={p.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[var(--text)]">
                        {p.campaigns?.title ?? "일반 후원"}
                      </span>
                      <Badge
                        className={`border-0 font-medium ${STATUS_BADGE_CLS[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {TYPE_LABEL[p.type]}
                      </span>
                    </div>

                    <div className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">
                      {p.promise_code}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-4">
                      <div>
                        <span className="block text-xs">약정 금액</span>
                        <span className="font-medium text-[var(--text)]">
                          {formatAmount(p.amount)}
                        </span>
                      </div>
                      {p.type === "regular" && (
                        <div>
                          <span className="block text-xs">결제일</span>
                          <span className="font-medium text-[var(--text)]">
                            매월 {p.pay_day ?? "-"}일
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs">시작일</span>
                        <span className="font-medium text-[var(--text)]">
                          {formatDate(p.started_at)}
                        </span>
                      </div>
                      {p.ended_at && (
                        <div>
                          <span className="block text-xs">종료일</span>
                          <span className="font-medium text-[var(--text)]">
                            {formatDate(p.ended_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {isActive && (
                        <>
                          <button
                            type="button"
                            disabled={actioning === p.id}
                            onClick={() => openAmountDialog(p)}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            금액 변경
                          </button>
                          <button
                            type="button"
                            disabled={actioning === p.id}
                            onClick={() => handleAction(p.id, "suspend")}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            일시중지
                          </button>
                        </>
                      )}
                      {isSuspended && (
                        <button
                          type="button"
                          disabled={actioning === p.id}
                          onClick={() => handleAction(p.id, "resume")}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          재개
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actioning === p.id}
                        onClick={() => handleAction(p.id, "cancel")}
                        className="rounded-md border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-xs font-medium text-[var(--negative)] transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        해지
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
