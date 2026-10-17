"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Sheet } from "@/components/ui/layer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { ClaimablePayment, ClaimLine } from "@/lib/cms/claim";
import { formatKRW as won } from "@/lib/format";

/**
 * 자동이체(CMS) 청구 — 3단계로만 보이게 한다.
 *  1. 출금일을 고르면 출금할 후원 목록이 나온다(기본 모두 선택)
 *  2. "명단 내려받기" → CMS 대행사 프로그램(효성CMS 등)에 올린다
 *  3. 대행사 결과가 나오면 "결과 반영"에서 실패한 사람만 체크 → 나머지는 출금 완료
 */
export type ClaimFileRow = {
  id: string;
  filename: string;
  claimDate: string;
  count: number;
  total: number;
  status: "draft" | "submitted" | "result_received" | "completed";
  successCount: number | null;
  failCount: number | null;
};

const FILE_STATUS: Record<ClaimFileRow["status"], { label: string; tone: string }> = {
  draft: { label: "만드는 중", tone: "var(--muted-foreground)" },
  submitted: { label: "결과 기다리는 중", tone: "var(--warning)" },
  result_received: { label: "일부 반영됨", tone: "var(--accent)" },
  completed: { label: "반영 끝", tone: "var(--positive)" },
};

const dot = (d: string | null) => (d ? d.slice(0, 10).replace(/-/g, ".") : "-");

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFrom(res: Response, fallback: string) {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename="([^"]+)"/);
  return m ? decodeURIComponent(m[1]) : fallback;
}

export function CmsClaimBoard({
  claimDate,
  claimable,
  files,
}: {
  claimDate: string;
  claimable: ClaimablePayment[];
  files: ClaimFileRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(claimable.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [resultFor, setResultFor] = useState<ClaimFileRow | null>(null);

  const chosen = claimable.filter((p) => selected.has(p.id));
  const chosenTotal = chosen.reduce((s, p) => s + p.amount, 0);
  const waiting = files.filter((f) => f.status === "submitted" || f.status === "result_received");

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cms-claim-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimDate, paymentIds: chosen.map((p) => p.id) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "명단을 만들지 못했습니다.");
        return;
      }
      downloadBlob(await res.blob(), filenameFrom(res, "자동이체청구.csv"));
      toast.success(`${chosen.length}건 명단을 내려받았어요. CMS 프로그램에 올려 주세요.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function redownload(f: ClaimFileRow) {
    const res = await fetch(`/api/admin/cms-claim-files/${f.id}/csv`);
    if (!res.ok) {
      toast.error("내려받지 못했습니다.");
      return;
    }
    downloadBlob(await res.blob(), filenameFrom(res, f.filename));
  }

  const payColumns: DataTableColumn<ClaimablePayment>[] = [
    {
      key: "member",
      header: "후원자",
      render: (p) => (
        <span className="whitespace-nowrap">
          {p.memberName || "-"}
          {p.memberCode && <span className="ml-1 font-mono text-xs text-[var(--muted-foreground)]">{p.memberCode}</span>}
        </span>
      ),
      sortValue: (p) => p.memberName,
    },
    { key: "amount", header: "출금금액", align: "right", render: (p) => won(p.amount), sortValue: (p) => p.amount },
    { key: "payDate", header: "출금 예정일", render: (p) => dot(p.payDate), sortValue: (p) => p.payDate },
    { key: "code", header: "결제번호", render: (p) => <span className="font-mono text-xs">{p.paymentCode}</span> },
  ];

  const fileColumns: DataTableColumn<ClaimFileRow>[] = [
    { key: "claimDate", header: "출금일", render: (f) => dot(f.claimDate), sortValue: (f) => f.claimDate },
    { key: "count", header: "건수", align: "right", render: (f) => `${f.count.toLocaleString("ko-KR")}건`, sortValue: (f) => f.count },
    { key: "total", header: "금액", align: "right", render: (f) => won(f.total), sortValue: (f) => f.total },
    {
      key: "status",
      header: "상태",
      render: (f) => (
        <span className="whitespace-nowrap font-semibold" style={{ color: FILE_STATUS[f.status].tone }}>
          {FILE_STATUS[f.status].label}
          {f.status !== "submitted" && f.successCount != null && (
            <span className="ml-1 font-normal text-[var(--muted-foreground)]">
              (완료 {f.successCount} · 실패 {f.failCount ?? 0})
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">자동이체(CMS) 청구</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
          계좌 자동이체로 후원하는 분들의 출금 명단을 만들어 CMS 대행사 프로그램(효성CMS 등)에 올리고, 결과가 나오면 여기에 반영해요.
          반영하면 결제 내역과 회계(ERP)에 자동으로 기록돼요.
        </p>
      </div>

      <ol className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["출금 명단 만들기", "출금일을 고르고 명단을 내려받아요."],
          ["CMS 프로그램에 올리기", "내려받은 엑셀 파일을 대행사 프로그램에 올려요."],
          ["결과 반영하기", "실패한 분만 체크하면 나머지는 출금 완료로 처리돼요."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              {i + 1}
            </span>
            <span>
              <span className="block font-semibold text-[var(--text)]">{t}</span>
              <span className="block text-xs text-[var(--muted-foreground)]">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {waiting.length > 0 && (
        <p role="status" className="rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text)]">
          결과를 기다리는 명단이 {waiting.length}개 있어요. 대행사 결과가 나오면 아래 ‘지난 청구 명단’에서 ‘결과 반영’을 눌러 주세요.
        </p>
      )}

      <section aria-labelledby="cms-new" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cms-new" className="text-lg font-semibold text-[var(--text)]">
              1. 출금 명단 만들기
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">출금 예정일이 이 날짜까지인 자동이체 후원이 나와요. 다른 명단에 들어가 결과를 기다리는 건은 빠져요.</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="cms-date" className="text-xs">
                출금일
              </Label>
              <Input
                id="cms-date"
                type="date"
                value={claimDate}
                onChange={(e) => e.target.value && router.push(`/admin/cms-claims?date=${e.target.value}`)}
                className="w-40"
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={payColumns}
          rows={claimable}
          rowKey={(p) => p.id}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          caption="출금할 자동이체 후원"
          emptyMessage="이 날짜까지 출금할 자동이체 후원이 없어요."
          emptyHint="다른 출금일을 골라 보거나, 정기후원 관리에서 결제수단이 자동이체(CMS)인 후원이 있는지 확인하세요."
        />

        {claimable.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-[var(--text)] tabular-nums">
              {chosen.length}건 · <strong>{won(chosenTotal)}</strong>
            </p>
            <Button onClick={create} loading={busy} disabled={chosen.length === 0}>
              명단 만들고 내려받기
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="cms-history" className="space-y-3">
        <h2 id="cms-history" className="text-lg font-semibold text-[var(--text)]">
          지난 청구 명단
        </h2>
        <DataTable
          columns={fileColumns}
          rows={files}
          rowKey={(f) => f.id}
          caption="지난 자동이체 청구 명단"
          emptyMessage="아직 만든 명단이 없어요."
          rowActions={(f) => (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => redownload(f)}>
                다시 내려받기
              </Button>
              {f.status !== "completed" && (
                <Button size="sm" variant="outline" onClick={() => setResultFor(f)}>
                  결과 반영
                </Button>
              )}
            </div>
          )}
        />
      </section>

      {resultFor && (
        <ResultSheet
          file={resultFor}
          onClose={() => setResultFor(null)}
          onDone={() => {
            setResultFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ResultSheet({ file, onClose, onDone }: { file: ClaimFileRow; onClose: () => void; onDone: () => void }) {
  const confirm = useConfirm();
  const [lines, setLines] = useState<ClaimLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/cms-claim-files/${file.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { lines: ClaimLine[] }) => alive && setLines(j.lines))
      .catch(() => alive && setLoadError("명단을 불러오지 못했습니다. 닫았다가 다시 열어 주세요."));
    return () => {
      alive = false;
    };
  }, [file.id]);

  const pending = (lines ?? []).filter((l) => l.resultCode === null);
  const done = (lines ?? []).filter((l) => l.resultCode !== null);
  const okCount = pending.length - failed.size;

  async function submit() {
    const ok = await confirm({
      title: `출금 완료 ${okCount}건, 실패 ${failed.size}건으로 반영할까요?`,
      description: "반영하면 결제 내역과 회계(ERP)에 기록되고 되돌리기 어려워요. 대행사 결과와 한 번 더 맞춰 보세요.",
      confirmText: "결과 반영하기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cms-claim-files/${file.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failedLineIds: [...failed], failReason: reason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "반영하지 못했습니다.");
        return;
      }
      toast.success(`출금 완료 ${json.paid}건, 실패 ${json.failed}건을 반영했어요.`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setFailed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`출금 결과 반영 · ${dot(file.claimDate)}`}
      description="대행사 결과에서 출금이 안 된 분만 체크하세요. 체크하지 않은 분은 출금 완료로 처리돼요."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={submit} loading={busy} disabled={!lines || pending.length === 0}>
            완료 {okCount}건 · 실패 {failed.size}건 반영
          </Button>
        </>
      }
    >
      {loadError && (
        <p role="alert" className="text-sm text-[var(--negative)]">
          {loadError}
        </p>
      )}
      {!lines && !loadError && <p role="status" className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>}
      {lines && (
        <div className="space-y-4">
          {pending.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[var(--text)]">출금이 안 된 분 체크</legend>
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {pending.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--surface-2)]">
                      <input type="checkbox" checked={failed.has(l.id)} onChange={() => toggle(l.id)} aria-label={`${l.memberName} 출금 실패`} />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm text-[var(--text)]">{l.memberName || "-"}</span>
                        {l.memberCode && <span className="ml-1 font-mono text-xs text-[var(--muted-foreground)]">{l.memberCode}</span>}
                      </span>
                      <span className="text-sm tabular-nums text-[var(--text)]">{won(l.amount)}</span>
                      <span className={`w-14 text-right text-xs font-semibold ${failed.has(l.id) ? "text-[var(--negative)]" : "text-[var(--positive)]"}`}>
                        {failed.has(l.id) ? "실패" : "완료"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">이 명단은 모두 반영됐어요.</p>
          )}
          {failed.size > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cms-reason">실패 사유 (선택)</Label>
              <Input id="cms-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 잔액 부족" maxLength={200} />
              <p className="text-xs text-[var(--muted-foreground)]">실패한 건은 ‘자동이체(CMS) 실패’ 화면에서 다시 청구하거나 직접 받은 것으로 처리할 수 있어요.</p>
            </div>
          )}
          {done.length > 0 && (
            <details className="text-xs text-[var(--muted-foreground)]">
              <summary className="cursor-pointer">이미 반영한 {done.length}건 보기</summary>
              <ul className="mt-2 space-y-1">
                {done.map((l) => (
                  <li key={l.id}>
                    {l.memberName} · {won(l.amount)} · {l.resultCode === "00" ? "완료" : `실패(${l.resultMessage ?? ""})`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}
