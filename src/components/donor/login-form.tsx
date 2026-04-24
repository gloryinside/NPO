"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OtpLoginForm } from "@/components/donor/otp-login-form";
import { BypassLoginForm } from "@/components/donor/bypass-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tab = "otp" | "password";

type PasswordPhase =
  | { kind: "credentials" }
  | { kind: "mfa"; factorId: string };

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<PasswordPhase>({ kind: "credentials" });
  const [mfaCode, setMfaCode] = useState("");
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
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
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
      setError("로그인 중 오류가 발생했습니다.");
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
        setError("인증 코드가 올바르지 않습니다.");
        return;
      }
      router.push("/donor");
      router.refresh();
    } catch {
      setError("인증 처리 중 오류가 발생했습니다.");
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

  if (phase.kind === "mfa") {
    return (
      <form onSubmit={handleMfa} className="space-y-4">
        <div>
          <p className="text-sm text-[var(--text)]">
            <span aria-hidden="true">🔐</span> 2단계 인증
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            인증 앱에 표시된 6자리 코드를 입력해 주세요.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="mfa-code"
            className="text-sm text-[var(--muted-foreground)]"
          >
            인증 코드
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
            취소
          </Button>
          <Button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="flex-1 bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "확인 중..." : "인증"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm text-[var(--muted-foreground)]">이메일</Label>
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
        <Label htmlFor="password" className="text-sm text-[var(--muted-foreground)]">비밀번호</Label>
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
        {loading ? "로그인 중..." : "로그인"}
      </Button>
      <p className="text-center text-xs">
        <a
          href="/donor/password/forgot"
          className="text-[var(--muted-foreground)] hover:underline"
        >
          비밀번호를 잊으셨나요?
        </a>
      </p>
    </form>
  );
}

export function DonorLoginForm({ bypass = false }: { bypass?: boolean }) {
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
          후원자 로그인
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          기부 내역이 있는 계정으로 로그인하세요.
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
                휴대폰 인증
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
                이메일/비밀번호
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
          아직 계정이 없으신가요?{" "}
          <a href="/donor/signup" className="text-[var(--accent)] hover:underline">
            회원가입
          </a>
        </p>
      </div>
    </div>
  );
}
