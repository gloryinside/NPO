"use client";

import { useCallback, useEffect, useState } from "react";
import { useDonorT } from "@/lib/i18n/use-donor-t";

interface MfaState {
  loading: boolean;
  isOtp: boolean;
  enabled: boolean;
  factors: Array<{ id: string; friendly_name: string | null; created_at: string }>;
  backupCodesRemaining: number;
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
  const t = useDonorT();
  const [state, setState] = useState<MfaState>({
    loading: true,
    isOtp: false,
    enabled: false,
    factors: [],
    backupCodesRemaining: 0,
  });
  const [enroll, setEnroll] = useState<EnrollStep>({ phase: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

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
      backupCodesRemaining: Number(data.backup_codes_remaining ?? 0),
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 백업 코드 평문이 화면에 떠 있는 동안 페이지 이탈 시 경고 (저장 유도)
  useEffect(() => {
    if (!newBackupCodes || newBackupCodes.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // returnValue 설정은 레거시 브라우저 호환 — 최신 브라우저는 기본 문구만 표시
      e.returnValue = t("donor.mfa.backup.leave_guard");
      return t("donor.mfa.backup.leave_guard");
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [newBackupCodes, t]);

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
        setError(data.error ?? t("donor.mfa.enroll.verify") + " — error");
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
        setError(data.error ?? t("donor.mfa.enroll.verify") + " — error");
        return;
      }
      setEnroll({ phase: "idle" });
      setCode("");
      if (Array.isArray(data.backup_codes) && data.backup_codes.length > 0) {
        setNewBackupCodes(data.backup_codes as string[]);
      }
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  async function regenerateBackup() {
    if (
      !confirm(
        t("donor.mfa.backup.confirm_regen"),
      )
    ) {
      return;
    }
    setError(null);
    setWorking(true);
    try {
      const res = await fetch("/api/donor/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_backup" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("donor.mfa.backup.regenerate") + " — error");
        return;
      }
      setNewBackupCodes(data.backup_codes as string[]);
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
    if (!confirm(t("donor.mfa.confirm_disable"))) return;
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
        setError(data.error ?? t("donor.mfa.disable") + " — error");
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
          <span aria-hidden="true">🔐</span> {t("donor.mfa.title")}
        </h3>
        <p>{t("donor.mfa.desc.otp_unsupported")}</p>
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
            <span aria-hidden="true">🔐</span> {t("donor.mfa.title")}
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {state.enabled
              ? t("donor.mfa.desc.enabled")
              : t("donor.mfa.desc.disabled")}
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
              {t("donor.mfa.disable")}
            </button>
          ) : (
            <button
              type="button"
              onClick={startEnroll}
              disabled={working}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {t("donor.mfa.enable")}
            </button>
          ))}
      </div>

      {enroll.phase === "qr" && (
        <div className="mt-5 space-y-4">
          <p className="text-sm" style={{ color: "var(--text)" }}>
            {t("donor.mfa.enroll.instruction")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enroll.qrCode}
              alt={t("donor.mfa.enroll.qr_alt")}
              width={160}
              height={160}
              className="rounded-lg border"
              style={{ borderColor: "var(--border)", background: "#fff" }}
            />
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              <p className="font-medium" style={{ color: "var(--text)" }}>
                {t("donor.mfa.enroll.secret_label")}
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
              {t("donor.mfa.enroll.code_placeholder")}
            </label>
            <input
              id="mfa-verify-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t("donor.mfa.enroll.code_placeholder")}
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
              {working ? t("donor.mfa.enroll.verifying") : t("donor.mfa.enroll.verify")}
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={working}
              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              {t("donor.mfa.enroll.cancel")}
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

      {state.enabled && enroll.phase === "idle" && (
        <div
          className="mt-5 rounded-lg border p-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-xs font-semibold"
                style={{ color: "var(--text)" }}
              >
                <span aria-hidden="true">🔑</span> {t("donor.mfa.backup.title")}
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("donor.mfa.backup.remaining", { count: state.backupCodesRemaining })}
                {state.backupCodesRemaining <= 2 && t("donor.mfa.backup.low_warning")}
              </p>
            </div>
            <button
              type="button"
              onClick={regenerateBackup}
              disabled={working}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{
                borderColor: "var(--border)",
                color: "var(--muted-foreground)",
              }}
            >
              {t("donor.mfa.backup.regenerate")}
            </button>
          </div>
        </div>
      )}

      {newBackupCodes && newBackupCodes.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-lg border p-4"
          style={{
            borderColor: "var(--warning)",
            background: "var(--warning-soft)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--warning)" }}
          >
            <span aria-hidden="true">⚠️</span> {t("donor.mfa.backup.new_title")}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("donor.mfa.backup.new_body")}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-center font-mono text-xs">
            {newBackupCodes.map((c) => (
              <li
                key={c}
                className="rounded border px-2 py-1.5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                }}
              >
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(newBackupCodes.join("\n"))
                  .catch(() => {});
              }}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: "var(--border)",
                color: "var(--muted-foreground)",
              }}
            >
              {t("donor.mfa.backup.copy")}
            </button>
            <button
              type="button"
              onClick={() => setNewBackupCodes(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              {t("donor.mfa.backup.saved")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
