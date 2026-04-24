"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OtpLoginForm } from "@/components/donor/otp-login-form";
import { BypassLoginForm } from "@/components/donor/bypass-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDonorT } from "@/lib/i18n/use-donor-t";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tab = "otp" | "password";

type PasswordPhase =
  | { kind: "credentials" }
  | { kind: "mfa"; factorId: string }
  | { kind: "backup"; factorId: string };

/**
 * MFA 필요 여부 판단.
 * aal1 상태로 인증됐지만 nextLevel 이 aal2 로 올라간 경우 → TOTP 입력 요구.
 */
async function determineMfaRequirement(
  supabase: SupabaseClient,
): Promise<{ required: boolean; factorId: string | null }> {
  const { data: aalData, error: aalErr } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) return { required: false, factorId: null };

  const { currentLevel, nextLevel } = aalData ?? {};
  if (currentLevel === "aal2" || nextLevel !== "aal2") {
    return { required: false, factorId: null };
  }

  // aal2 필요 — verified totp factor 중 첫 번째 사용
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verified = factorsData?.totp ?? [];
  if (verified.length === 0) return { required: false, factorId: null };
  return { required: true, factorId: verified[0].id };
}

function EmailPasswordForm() {
  const router = useRouter();
  const t = useDonorT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<PasswordPhase>({ kind: "credentials" });
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 페이지 로드 시 "aal1 세션 남아있음" = 이전 로그인에서 MFA 중간 상태 복귀
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { required, factorId } = await determineMfaRequirement(supabase);
      if (required && factorId) {
        setPhase({ kind: "mfa", factorId });
      }
    })();
  }, []);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(t("donor.login.password.error"));
        return;
      }

      const { required, factorId } = await determineMfaRequirement(supabase);
      if (required && factorId) {
        setPhase({ kind: "mfa", factorId });
        setPassword(""); // 비밀번호는 메모리에서 비움
        return;
      }

      router.push("/donor");
      router.refresh();
    } catch {
      setError(t("donor.login.password.generic_error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind !== "mfa") return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: challengeErr } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId: phase.factorId,
          code: mfaCode,
        });
      if (challengeErr) {
        setError(t("donor.login.mfa.error"));
        return;
      }
      router.push("/donor");
      router.refresh();
    } catch {
      setError(t("donor.login.mfa.generic_error"));
    } finally {
      setLoading(false);
    }
  }

  async function cancelMfa() {
    // TOTP 취소 시 aal1 세션을 명시적으로 로그아웃해 "반쯤 로그인된" 상태 방지
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut().catch(() => {});
    setPhase({ kind: "credentials" });
    setMfaCode("");
    setError(null);
  }

  async function handleBackup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/donor/account/mfa/backup-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: backupCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("donor.login.backup.error"));
        return;
      }
      router.push("/donor");
      router.refresh();
    } catch {
      setError(t("donor.login.mfa.generic_error"));
    } finally {
      setLoading(false);
    }
  }

  if (phase.kind === "mfa") {
    return (
      <form onSubmit={handleMfa} className="space-y-4">
        <div>
          <p className="text-sm text-[var(--text)]">
            <span aria-hidden="true">🔐</span> {t("donor.login.mfa.title")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("donor.login.mfa.instruction")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="mfa-code"
            className="text-sm text-[var(--muted-foreground)]"
          >
            {t("donor.login.mfa.label")}
          </Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            required
            placeholder="000000"
            className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] tracking-widest placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={cancelMfa}
            variant="outline"
            className="flex-1 border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
          >
            {t("donor.login.mfa.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="flex-1 bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("donor.login.mfa.submitting") : t("donor.login.mfa.submit")}
          </Button>
        </div>
        <p className="text-center text-xs">
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: "backup", factorId: phase.factorId });
              setMfaCode("");
              setError(null);
            }}
            className="text-[var(--muted-foreground)] hover:underline"
          >
            {t("donor.login.mfa.switch_backup")}
          </button>
        </p>
      </form>
    );
  }

  if (phase.kind === "backup") {
    return (
      <form onSubmit={handleBackup} className="space-y-4">
        <div>
          <p className="text-sm text-[var(--text)]">
            <span aria-hidden="true">🔑</span> {t("donor.login.backup.title")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("donor.login.backup.instruction")}

          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="backup-code"
            className="text-sm text-[var(--muted-foreground)]"
          >
            {t("donor.login.backup.label")}
          </Label>
          <Input
            id="backup-code"
            type="text"
            autoComplete="one-time-code"
            autoFocus
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            required
            placeholder="XXXX-XXXX"
            className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] tracking-widest placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => {
              setPhase({ kind: "mfa", factorId: phase.factorId });
              setBackupCode("");
              setError(null);
            }}
            variant="outline"
            className="flex-1 border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
          >
            {t("donor.login.backup.switch_totp")}
          </Button>
          <Button
            type="submit"
            disabled={loading || backupCode.replace(/[^A-Z0-9]/g, "").length < 8}
            className="flex-1 bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("donor.login.mfa.submitting") : t("donor.login.backup.submit")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm text-[var(--muted-foreground)]">{t("donor.login.password.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="donor@example.com"
          className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm text-[var(--muted-foreground)]">{t("donor.login.password.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--negative)]">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t("donor.login.password.submitting") : t("donor.login.password.submit")}
      </Button>
      <p className="text-center text-xs">
        <a
          href="/donor/password/forgot"
          className="text-[var(--muted-foreground)] hover:underline"
        >
          {t("donor.login.password.forgot")}
        </a>
      </p>
    </form>
  );
}

export function DonorLoginForm({ bypass = false }: { bypass?: boolean }) {
  const t = useDonorT();
  const [tab, setTab] = useState<Tab>("otp");

  // MFA 대기 상태(aal1 세션 존재 + aal2 필요)면 password 탭으로 점프
  useEffect(() => {
    if (bypass) return;
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { required } = await determineMfaRequirement(supabase);
      if (required) setTab("password");
    })();
  }, [bypass]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-semibold text-[var(--text)]">
          {t("donor.login.title_main")}
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          {t("donor.login.subtitle")}
        </p>

        {bypass ? (
          <BypassLoginForm />
        ) : (
          <>
            {/* 탭 */}
            <div className="mb-5 flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setTab("otp")}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  background: tab === "otp" ? "var(--accent)" : "var(--surface-2)",
                  color: tab === "otp" ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {t("donor.login.tab.otp")}
              </button>
              <button
                type="button"
                onClick={() => setTab("password")}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  background: tab === "password" ? "var(--accent)" : "var(--surface-2)",
                  color: tab === "password" ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {t("donor.login.tab.password")}
              </button>
            </div>

            {tab === "otp" ? (
              <OtpLoginForm />
            ) : (
              <EmailPasswordForm />
            )}
          </>
        )}

        <p className="mt-5 text-center text-sm text-[var(--muted-foreground)]">
          {t("donor.login.signup_prompt")}{" "}
          <a href="/donor/signup" className="text-[var(--accent)] hover:underline">
            {t("donor.login.signup_link")}
          </a>
        </p>
      </div>
    </div>
  );
}
