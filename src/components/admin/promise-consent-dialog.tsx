"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PromiseWithRelations } from "@/types/promise";
import { formatDate } from "@/lib/format";
import {
  CONSENT_METHOD_LABEL,
  PAYER_RELATION_LABEL,
  type ConsentMethod,
  type ConsentRow,
  type PayerRelation,
} from "@/lib/cms/withdrawal-consent";

/** 자동이체(CMS) 약정의 출금동의 기록 — 기록하면 '등록 대기' 약정은 '진행 중'이 된다 */

const MANUAL_METHODS: ConsentMethod[] = ["paper", "ars_recording", "electronic_signature"];

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const field = "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";
const select = "h-9 w-full rounded-md border px-2 text-sm bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";

export function ConsentDialog({
  promise,
  onClose,
  onDone,
}: {
  promise: PromiseWithRelations;
  onClose: () => void;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState<ConsentRow | null | undefined>(undefined);
  const [method, setMethod] = useState<ConsentMethod>("paper");
  const [payerName, setPayerName] = useState(promise.members?.name ?? "");
  const [relation, setRelation] = useState<PayerRelation>("self");
  const [bankName, setBankName] = useState("");
  const [account, setAccount] = useState("");
  const [consentedAt, setConsentedAt] = useState(todayKst());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/promises/${promise.id}/withdrawal-consent`)
      .then((r) => r.json())
      .then((d: { consent?: ConsentRow | null }) => alive && setCurrent(d.consent ?? null))
      .catch(() => alive && setCurrent(null));
    return () => {
      alive = false;
    };
  }, [promise.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promises/${promise.id}/withdrawal-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, payerName, payerRelation: relation, bankName, account, consentedAt, note }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const waiting = promise.status === "pending_billing";

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        <strong className="text-[var(--text)]">{promise.members?.name}</strong>님 자동이체의 출금동의를 기록합니다.
        {waiting && " 기록하면 약정이 '진행 중'으로 바뀌고 다음 출금일부터 청구 명단에 들어갑니다."}
      </p>

      {current && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          지금 기록: {CONSENT_METHOD_LABEL[current.method]} · 예금주 {current.payer_name}(
          {PAYER_RELATION_LABEL[current.payer_relation]})
          {current.bank_name ? ` · ${current.bank_name}` : ""}
          {current.account_last4 ? ` ****${current.account_last4}` : ""} · {formatDate(current.consented_at)}
          <br />
          새로 기록하면 이 기록은 '변경됨'으로 남습니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          동의 받은 방법
          <select id="consent-method" className={select} value={method} onChange={(e) => setMethod(e.target.value as ConsentMethod)}>
            {MANUAL_METHODS.map((m) => (
              <option key={m} value={m}>
                {CONSENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          동의한 날
          <Input id="consent-date" type="date" value={consentedAt} max={todayKst()} onChange={(e) => setConsentedAt(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          예금주 이름 <span className="sr-only">(필수)</span>
          <Input id="consent-payer" value={payerName} onChange={(e) => setPayerName(e.target.value)} className={field} required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          후원자와의 관계
          <select id="consent-relation" className={select} value={relation} onChange={(e) => setRelation(e.target.value as PayerRelation)}>
            {(Object.keys(PAYER_RELATION_LABEL) as PayerRelation[]).map((r) => (
              <option key={r} value={r}>
                {PAYER_RELATION_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          은행
          <Input id="consent-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="예: 국민은행" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
          계좌번호
          <Input
            id="consent-account"
            inputMode="numeric"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/[^0-9-]/g, ""))}
            className={field}
          />
          <span className="text-xs text-[var(--muted-foreground)]">끝 4자리만 저장합니다.</span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm text-[var(--text)]">
        메모 (선택)
        <Input id="consent-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 신청서 원본은 2층 문서함" className={field} />
      </label>

      {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]">
          취소
        </Button>
        <Button type="submit" loading={loading} disabled={current === undefined} className="bg-[var(--accent)] text-white disabled:opacity-60">
          출금동의 기록
        </Button>
      </div>
    </form>
  );
}
