'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'phone' | 'code';

export function OtpLoginForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/-/g, '') }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '발송 실패');
        return;
      }
      setPhase('code');
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/-/g, ''), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '인증 실패');
        return;
      }
      if (!data.ok && data.reason === 'no_member') {
        setError('해당 번호로 등록된 후원 내역이 없습니다.');
        return;
      }
      router.push('/donor');
      router.refresh();
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {phase === 'phone' ? (
        <>
          <input
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <button
            onClick={handleSendOtp}
            disabled={loading || phone.replace(/-/g, '').length < 10}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '발송 중…' : '인증번호 발송'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {phone}으로 발송된 인증번호를 입력하세요.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="인증번호 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border px-3 py-2 text-sm text-center tracking-widest outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '확인 중…' : '로그인'}
          </button>
          <button
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            번호 다시 입력
          </button>
        </>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--negative)' }}>{error}</p>}
    </div>
  );
}
