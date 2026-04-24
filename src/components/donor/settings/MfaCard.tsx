"use client";

import { useCallback, useEffect, useState } from "react";

interface MfaState {
  loading: boolean;
  isOtp: boolean;
  enabled: boolean;
  factors: Array<{ id: string; friendly_name: string | null; created_at: string }>;
}

type EnrollStep =
  | { phase: "idle" }
  | { phase: "qr"; factorId: string; qrCode: string; secret: string }
  | { phase: "verifying"; factorId: string; qrCode: string; secret: string };

/**
 * SP-5 / C: TOTP 2단계 인증 설정 카드
 *
 * - 현재 상태 조회 → 활성/비활성 분기
 * - 활성화: enroll → QR 표시 → 인증 앱 코드 입력 → 검증
 * - 해제: 확인 후 unenroll
 * - OTP 로그인 사용자에게는 미지원 안내
 */
export function MfaCard() {
  const [state, setState] = useState<MfaState>({
    loading: true,
    isOtp: false,
    enabled: false,
    factors: [],
  });
  const [enroll, setEnroll] = useState<EnrollStep>({ phase: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/donor/account/mfa");
    if (!res.ok) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const data = await res.json();
    setState({
      loading: false,
      isOtp: !!data.isOtp,
      enabled: !!data.enabled,
      factors: data.factors ?? [],
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/donor/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "활성화를 시작할 수 없습니다.");
        return;
      }
      setEnroll({
        phase: "qr",
        factorId: data.factorId,
        qrCode: data.qrCode,
        secret: data.secret,
      });
    } finally {
      setWorking(false);
    }
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault();
    if (enroll.phase !== "qr" && enroll.phase !== "verifying") return;
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/donor/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          factorId: enroll.factorId,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "인증에 실패했습니다.");
        return;
      }
      setEnroll({ phase: "idle" });
      setCode("");
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  async function cancelEnroll() {
    if (enroll.phase !== "qr") {
      setEnroll({ phase: "idle" });
      setCode("");
      return;
    }
    // QR까지 본 뒤 취소 → unverified factor 정리
    setWorking(true);
    try {
      await fetch("/api/donor/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unenroll",
          factorId: enroll.factorId,
        }),
      }).catch(() => {});
    } finally {
      setEnroll({ phase: "idle" });
      setCode("");
      setWorking(false);
    }
  }

  async function handleUnenroll(factorId: string) {
    if (!confirm("2단계 인증을 해제하시겠습니까?")) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/donor/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unenroll", factorId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "해제에 실패했습니다.");
        return;
      }
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  // ── 렌더링 ────────────────────────────────────────────
  if (state.loading) return null;

  const baseCardStyle = {
    borderColor: "var(--border)",
    background: "var(--surface)",
  };

  if (state.isOtp) {
    return (
      <div
        className="rounded-2xl border p-5 text-sm"
        style={{ ...baseCardStyle, color: "var(--muted-foreground)" }}
      >
        <h3
          className="mb-2 text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          <span aria-hidden="true">🔐</span> 2단계 인증
        </h3>
        <p>
          2단계 인증은 이메일/비밀번호 로그인 사용자만 설정할 수 있습니다.
          OTP 로그인은 단기 세션으로 자동 만료됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={baseCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            <span aria-hidden="true">🔐</span> 2단계 인증
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {state.enabled
              ? "TOTP 인증 앱이 연결되어 있습니다. 다음 로그인부터 6자리 코드가 필요합니다."
              : "Google Authenticator 등 TOTP 앱으로 로그인 보안을 강화하세요."}
          </p>
        </div>
        {enroll.phase === "idle" &&
          (state.enabled ? (
            <button
              type="button"
              onClick={() =>
                state.factors[0] && handleUnenroll(state.factors[0].id)
              }
              disabled={working}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              해제
            </button>
          ) : (
            <button
              type="button"
              onClick={startEnroll}
              disabled={working}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              활성화
            </button>
          ))}
      </div>

      {enroll.phase === "qr" && (
        <div className="mt-5 space-y-4">
          <p className="text-sm" style={{ color: "var(--text)" }}>
            인증 앱에서 다음 QR 코드를 스캔하거나, 시크릿을 직접 입력한 뒤
            생성된 6자리 코드를 입력하세요.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enroll.qrCode}
              alt="TOTP 등록 QR 코드"
              width={160}
              height={160}
              className="rounded-lg border"
              style={{ borderColor: "var(--border)", background: "#fff" }}
            />
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              <p className="font-medium" style={{ color: "var(--text)" }}>
                시크릿 키
              </p>
              <code
                className="mt-1 inline-block break-all rounded px-2 py-1 text-xs"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                }}
              >
                {enroll.secret}
              </code>
            </div>
          </div>

          <form onSubmit={submitVerify} className="flex flex-wrap items-center gap-2">
            <label htmlFor="mfa-verify-code" className="sr-only">
              6자리 인증 코드
            </label>
            <input
              id="mfa-verify-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6자리 코드"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              className="w-32 rounded-lg border px-3 py-2 text-sm tracking-widest"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
              }}
            />
            <button
              type="submit"
              disabled={working || code.length !== 6}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {working ? "확인 중…" : "확인"}
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={working}
              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              취소
            </button>
          </form>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-xs"
          style={{ color: "var(--negative)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
