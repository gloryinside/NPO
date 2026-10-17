'use client';
import { useEffect, useRef, useState } from 'react';
import SignaturePad, { type SignaturePadHandle } from '@/components/public/donation/SignaturePad';
import { PAYER_RELATIONS, PAYER_RELATION_LABEL } from '@/lib/cms/withdrawal-consent';
import type { WizardState } from '../WizardClient';

/** 다음 신청자가 앞사람 정보를 보지 않게 — 아무 조작이 없으면 이 시간 뒤 첫 화면으로 */
const IDLE_RESET_MS = 120_000;

/**
 * 현장 모금(태블릿) 신청 완료 화면.
 *  - 자동이체(CMS) 정기후원이면 그 자리에서 출금동의 서명을 받는다(서명 이미지가 증빙)
 *  - 끝나면 화면을 비우고 다음 분 신청을 받는다
 */
export function KioskFinish({ token, state }: { token: string; state: WizardState }) {
  const needsConsent = state.type === 'regular' && state.paymentMethod === 'cms' && !!state.paymentId;
  const pad = useRef<SignaturePadHandle>(null);
  const [signed, setSigned] = useState(false);
  const [payerName, setPayerName] = useState(state.donorInfo?.name ?? '');
  const [payerRelation, setPayerRelation] = useState<string>('self');
  const [bankName, setBankName] = useState('');
  const [last4, setLast4] = useState('');
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(!needsConsent);
  const [error, setError] = useState<string | null>(null);

  const next = () => window.location.replace(`/f2f/${token}`);

  useEffect(() => {
    let timer = setTimeout(next, IDLE_RESET_MS);
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(next, IDLE_RESET_MS);
    };
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const signature = pad.current?.toDataUrl();
    if (!signature) return setError('서명해 주세요.');
    setSending(true);
    setError(null);
    const res = await fetch('/api/f2f/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        paymentId: state.paymentId,
        payerName,
        payerRelation,
        bankName,
        account: last4,
        signature,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSending(false);
    if (!res.ok) return setError(data.error ?? '서명을 저장하지 못했어요. 다시 시도해 주세요.');
    setDone(true);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-center">
        <p className="text-xl font-bold text-[var(--text)]">신청해 주셔서 감사합니다</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {state.amount.toLocaleString('ko-KR')}원 {state.type === 'regular' ? '매월' : '일시'} 후원
          {state.paymentCode && <> · 접수번호 {state.paymentCode}</>}
        </p>
      </div>

      {!done && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-base font-semibold text-[var(--text)]">자동이체 출금 동의</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            매월 {state.amount.toLocaleString('ko-KR')}원을 아래 계좌에서 자동이체로 출금하는 데 동의하시면 서명해 주세요.
            계좌번호 전체는 기관이 출금 등록을 할 때 따로 확인하고, 여기에는 은행과 끝 4자리만 남깁니다.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--text)]">
              예금주
              <input value={payerName} onChange={(e) => setPayerName(e.target.value)} required maxLength={50}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3" />
            </label>
            <label className="text-sm text-[var(--text)]">
              후원자와의 관계
              <select value={payerRelation} onChange={(e) => setPayerRelation(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
                {PAYER_RELATIONS.map((r) => <option key={r} value={r}>{PAYER_RELATION_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="text-sm text-[var(--text)]">
              은행
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} required maxLength={30} placeholder="예: 국민은행"
                className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3" />
            </label>
            <label className="text-sm text-[var(--text)]">
              계좌번호 끝 4자리
              <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" pattern="[0-9]{4}"
                className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 tabular-nums" />
            </label>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm text-[var(--text)]">
              <span>예금주 서명</span>
              <button type="button" onClick={() => pad.current?.clear()} className="text-xs underline text-[var(--muted-foreground)]">지우기</button>
            </div>
            <SignaturePad ref={pad} label="예금주 서명 칸" onChange={setSigned} />
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            위 계좌에서 매월 후원금을 자동이체로 출금하는 데 동의합니다. 언제든 기관에 연락하거나 마이페이지에서 해지할 수 있습니다.
          </label>
          {error && <p role="alert" className="text-sm text-[var(--negative)]">{error}</p>}
          <button type="submit" disabled={sending || !signed || !agree || last4.length !== 4}
            className="w-full min-h-[48px] rounded-xl bg-[var(--accent)] text-base font-semibold text-white disabled:opacity-50">
            {sending ? '저장하는 중…' : '서명 제출'}
          </button>
        </form>
      )}

      {done && (
        <button type="button" onClick={next}
          className="w-full min-h-[52px] rounded-xl bg-[var(--accent)] text-base font-semibold text-white">
          다음 분 신청 받기
        </button>
      )}
      <p className="text-center text-xs text-[var(--muted-foreground)]">2분 동안 아무 조작이 없으면 화면이 처음으로 돌아갑니다.</p>
    </div>
  );
}
