"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Modal } from "@/components/ui/layer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 카드 결제 이의 제기(chargeback) — 카드사에 "내가 한 결제가 아니다/취소해 달라"는 요청이 들어온 건.
 * 카드사·토스 연락을 받은 담당자가 결제번호로 등록하고, 진행 상황을 단계별로 바꾼다.
 */
export type ChargebackRow = {
  id: string;
  amount: number;
  reason: string;
  status: Status;
  tossCaseId: string | null;
  createdAt: string;
  closedAt: string | null;
  paymentCode: string | null;
  memberName: string | null;
  memberCode: string | null;
  memberId: string | null;
  notes: Array<{ at: string; by: string | null; note: string | null; status: string }>;
};

type Status = "open" | "evidence_submitted" | "won" | "lost" | "closed";

const STATUS: Record<Status, { label: string; desc: string; tone: string }> = {
  open: { label: "접수됨", desc: "카드사에서 이의 제기가 들어왔어요. 소명 자료를 준비하세요.", tone: "var(--warning)" },
  evidence_submitted: { label: "소명 자료 보냄", desc: "후원 신청 기록 등 자료를 보냈고 결과를 기다려요.", tone: "var(--accent)" },
  won: { label: "결제 유지", desc: "카드사가 결제를 인정했어요. 후원금은 그대로예요.", tone: "var(--positive)" },
  lost: { label: "금액 회수됨", desc: "카드사가 금액을 돌려줬어요. 결제 내역·영수증 정리가 필요해요.", tone: "var(--negative)" },
  closed: { label: "종료", desc: "더 처리할 일이 없는 건이에요.", tone: "var(--muted-foreground)" },
};

const NEXT: Record<Status, Status[]> = {
  open: ["evidence_submitted", "won", "lost", "closed"],
  evidence_submitted: ["won", "lost", "closed"],
  won: ["closed"],
  lost: ["closed"],
  closed: [],
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, ".") : "-");

export function ChargebackList({ rows }: { rows: ChargebackRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ChargebackRow | null>(null);

  const columns: DataTableColumn<ChargebackRow>[] = [
    { key: "createdAt", header: "등록일", render: (r) => day(r.createdAt), sortValue: (r) => r.createdAt },
    {
      key: "member",
      header: "후원자",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.memberName ?? "-"}
          {r.memberCode && <span className="ml-1 font-mono text-xs text-[var(--muted-foreground)]">{r.memberCode}</span>}
        </span>
      ),
      sortValue: (r) => r.memberName,
    },
    { key: "payment", header: "결제번호", render: (r) => <span className="font-mono text-xs">{r.paymentCode ?? "-"}</span> },
    { key: "amount", header: "금액", align: "right", render: (r) => won(r.amount), sortValue: (r) => r.amount },
    { key: "reason", header: "사유", render: (r) => <span className="text-[var(--muted-foreground)]">{r.reason || "-"}</span> },
    {
      key: "status",
      header: "진행 상황",
      hint: "접수됨 → 소명 자료 보냄 → 결제 유지 또는 금액 회수됨 → 종료",
      render: (r) => (
        <span className="whitespace-nowrap font-semibold" style={{ color: STATUS[r.status]?.tone }}>
          {STATUS[r.status]?.label ?? r.status}
        </span>
      ),
      sortValue: (r) => Object.keys(STATUS).indexOf(r.status),
    },
  ];

  const openCount = rows.filter((r) => r.status === "open" || r.status === "evidence_submitted").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">카드 결제 이의 제기</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
            후원자가 카드사에 결제 취소를 요청하면 카드사나 토스에서 연락이 와요. 연락을 받으면 결제번호로 여기에 등록하고 진행 상황을 기록하세요.
            등록한 후원자에게는 분쟁 표시가 붙어요.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>이의 제기 등록</Button>
      </div>

      {openCount > 0 && (
        <p role="status" className="rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text)]">
          처리 중인 건이 {openCount}건 있어요. 카드사가 정한 기한 안에 소명 자료를 보내야 결제가 유지돼요.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        caption="카드 결제 이의 제기 목록"
        emptyMessage="등록된 이의 제기가 없어요."
        emptyHint="카드사나 토스에서 이의 제기 연락을 받으면 ‘이의 제기 등록’으로 기록하세요."
        onRowClick={(r) => setEditing(r)}
        rowLabel={(r) => `${r.memberName ?? "후원자"} 이의 제기 진행 상황 바꾸기`}
        rowActions={(r) =>
          NEXT[r.status].length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
              진행 상황 바꾸기
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
              기록 보기
            </Button>
          )
        }
      />

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <StatusDialog
          row={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [paymentCode, setPaymentCode] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [tossCaseId, setTossCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chargebacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCode,
          reason,
          amount: amount ? Number(amount.replace(/[^0-9]/g, "")) : undefined,
          tossCaseId: tossCaseId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "등록하지 못했습니다.");
        return;
      }
      toast.success("이의 제기를 등록했어요.");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="이의 제기 등록"
      description="결제번호는 ‘결제 내역’ 화면이나 카드사 안내문에서 확인할 수 있어요."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" form="chargeback-create" loading={busy} disabled={!paymentCode.trim() || !reason.trim()}>
            등록하기
          </Button>
        </>
      }
    >
      <form id="chargeback-create" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cb-code">결제번호</Label>
          <Input id="cb-code" value={paymentCode} onChange={(e) => setPaymentCode(e.target.value)} placeholder="예: PAY-2026-0123" autoComplete="off" spellCheck={false} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-reason">사유</Label>
          <Input id="cb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 본인이 결제하지 않았다고 신고" maxLength={500} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cb-amount">금액 (선택)</Label>
            <Input id="cb-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="비우면 결제금액 전체" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-case">카드사·토스 접수번호 (선택)</Label>
            <Input id="cb-case" value={tossCaseId} onChange={(e) => setTossCaseId(e.target.value)} autoComplete="off" spellCheck={false} />
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function StatusDialog({ row, onClose, onDone }: { row: ChargebackRow; onClose: () => void; onDone: () => void }) {
  const options = NEXT[row.status];
  const [status, setStatus] = useState<Status | null>(options[0] ?? null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chargebacks/${row.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "바꾸지 못했습니다.");
        return;
      }
      toast.success(`‘${STATUS[status].label}’(으)로 바꿨어요.`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${row.memberName ?? "후원자"} · ${won(row.amount)}`}
      description={`지금: ${STATUS[row.status].label} — ${STATUS[row.status].desc}`}
      footer={
        options.length > 0 ? (
          <>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            <Button onClick={submit} loading={busy} disabled={!status}>
              진행 상황 바꾸기
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {options.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-[var(--text)]">어떻게 됐나요?</legend>
            {options.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  status === s ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]"
                }`}
              >
                <input type="radio" name="cb-status" value={s} checked={status === s} onChange={() => setStatus(s)} className="mt-1" />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">{STATUS[s].label}</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">{STATUS[s].desc}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {status === "lost" && (
          <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text)]">
            금액이 회수됐다면 ‘결제 내역’에서 이 결제를 취소 처리해 주세요. 올해 기부금영수증을 이미 발급했다면 다시 발급해야 금액이 맞아요.
          </p>
        )}
        {options.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="cb-note">메모 (선택)</Label>
            <Input id="cb-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 후원 신청서·통화 녹취 보냄" maxLength={500} />
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-[var(--muted-foreground)]">결제번호</dt>
          <dd className="font-mono">{row.paymentCode ?? "-"}</dd>
          <dt className="text-[var(--muted-foreground)]">사유</dt>
          <dd>{row.reason || "-"}</dd>
          {row.tossCaseId && (
            <>
              <dt className="text-[var(--muted-foreground)]">접수번호</dt>
              <dd className="font-mono">{row.tossCaseId}</dd>
            </>
          )}
        </dl>
        {row.notes.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">지난 기록</p>
            <ol className="space-y-1.5 text-xs">
              {row.notes.map((n, i) => (
                <li key={i} className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                  <span className="text-[var(--muted-foreground)]">
                    {day(n.at)} · {STATUS[n.status as Status]?.label ?? n.status}
                    {n.by ? ` · ${n.by}` : ""}
                  </span>
                  {n.note && <p className="mt-0.5 text-[var(--text)]">{n.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
