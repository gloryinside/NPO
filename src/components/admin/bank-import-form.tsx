"use client";

import { useState } from "react";

/**
 * G-D148: 은행 거래내역 CSV 업로드 UI.
 * FormData/File 업로드 대신 text 읽어 POST /api/admin/bank-statements/import 에 전송.
 */
export function BankImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | {
        kind: "ok";
        matched: number;
        unmatched: number;
        ambiguous: number;
        imported: number;
        batchId: string;
      }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setState({ kind: "loading" });
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/bank-statements/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        batchId?: string;
        imported?: number;
        matched?: number;
        unmatched?: number;
        ambiguous?: number;
      };
      if (!res.ok || !data.ok) {
        setState({ kind: "err", msg: data.error ?? "업로드 실패" });
        return;
      }
      setState({
        kind: "ok",
        matched: data.matched ?? 0,
        unmatched: data.unmatched ?? 0,
        ambiguous: data.ambiguous ?? 0,
        imported: data.imported ?? 0,
        batchId: data.batchId ?? "",
      });
    } catch {
      setState({ kind: "err", msg: "네트워크 오류" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="bank-csv"
          className="block text-sm font-medium"
          style={{ color: "var(--text)" }}
        >
          은행 거래내역 CSV
        </label>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          헤더: <code>date,counterparty,amount,memo,bank_ref</code>{" "}
          (또는 한글 date,이체인,금액,memo,거래번호)
        </p>
        <input
          id="bank-csv"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!file || state.kind === "loading"}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {state.kind === "loading" ? "처리 중…" : "업로드 + 자동 매칭"}
      </button>

      {state.kind === "err" && (
        <p className="text-sm" style={{ color: "var(--negative)" }}>
          {state.msg}
        </p>
      )}
      {state.kind === "ok" && (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            borderColor: "var(--positive)",
            background: "var(--positive-soft)",
            color: "var(--positive)",
          }}
        >
          ✅ {state.imported}건 import · 자동 매칭 <b>{state.matched}</b>건,{" "}
          모호 {state.ambiguous}건, 미매칭 {state.unmatched}건
          <p
            className="mt-1 font-mono text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            batch: {state.batchId}
          </p>
        </div>
      )}
    </form>
  );
}
