"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/brand/auth-shell";

/**
 * 관리자 2단계 인증(OTP 앱: Google Authenticator·Microsoft Authenticator 등)
 *  - AdminMfaChallenge: 로그인 뒤 6자리 코드 입력
 *  - AdminMfaSetup: 등록(QR) · 해제 · 기관 전체 필수 설정(최고 관리자)
 * Supabase Auth MFA를 브라우저에서 바로 쓴다 — 코드 확인이 끝나면 세션이 aal2로 바뀐다.
 */

const FRIENDLY_NAME = "관리자 OTP";

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="mfa-code" className="text-sm font-medium text-[var(--text)]">
        OTP 앱의 6자리 숫자
      </Label>
      <Input
        id="mfa-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="text-center text-xl tracking-[0.4em] tabular-nums"
        autoFocus
      />
    </div>
  );
}

async function signOut(router: ReturnType<typeof useRouter>) {
  await createSupabaseBrowserClient().auth.signOut();
  router.replace("/admin/login");
}

export function AdminMfaChallenge() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const f = data?.totp?.[0];
        if (f) setFactorId(f.id);
        else router.replace("/admin");
      });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const { error: err } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
    setLoading(false);
    if (err) {
      setError("코드가 맞지 않아요. 앱에 보이는 최신 숫자를 입력해 주세요.");
      setCode("");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <AuthShell eyebrow="Admin Console" tagline="한 단계만 더 확인할게요.">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-card">
        <h1 className="text-lg font-semibold text-[var(--text)]">2단계 인증</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">휴대폰의 OTP 앱을 열어 이 계정의 6자리 숫자를 입력해 주세요.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <CodeInput value={code} onChange={setCode} />
          {error && (
            <p role="alert" className="text-sm text-[var(--negative)]">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading} disabled={!factorId || code.length !== 6}>
            확인
          </Button>
        </form>
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          휴대폰을 잃어버렸다면 기관의 최고 관리자에게 등록 해제를 요청하세요.{" "}
          <button type="button" onClick={() => signOut(router)} className="underline">
            다른 계정으로 로그인
          </button>
        </p>
      </div>
    </AuthShell>
  );
}

type Enroll = { factorId: string; qr: string; secret: string };

export function AdminMfaSetup({ orgRequires, isSuper }: { orgRequires: boolean; isSuper: boolean }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [verified, setVerified] = useState<{ id: string } | null>(null);
  const [aal2, setAal2] = useState(false);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState(orgRequires);

  const refresh = useCallback(async () => {
    const sb = createSupabaseBrowserClient();
    const [{ data: factors }, { data: level }] = await Promise.all([sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()]);
    setVerified(factors?.totp?.[0] ? { id: factors.totp[0].id } : null);
    setAal2(level?.currentLevel === "aal2");
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const sb = createSupabaseBrowserClient();
    // 끝내지 못한 등록이 남아 있으면 같은 이름으로 새로 만들 수 없다 — 먼저 지운다
    const { data: factors } = await sb.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: err } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: FRIENDLY_NAME });
    setBusy(false);
    if (err || !data) return setError("등록을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code });
    setBusy(false);
    if (err) {
      setCode("");
      return setError("코드가 맞지 않아요. 앱에 새로 생긴 항목의 최신 숫자를 입력해 주세요.");
    }
    setEnroll(null);
    setCode("");
    await refresh();
    router.refresh();
  }

  async function removeFactor() {
    if (!verified) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createSupabaseBrowserClient().auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (err) return setError("해제하지 못했어요. 코드로 다시 로그인한 뒤 시도해 주세요.");
    await refresh();
    router.refresh();
  }

  async function toggleRequired(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/settings/admin-mfa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: next }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "저장하지 못했어요.");
    setRequired(next);
  }

  return (
    <AuthShell eyebrow="Admin Console" tagline="관리자 계정을 휴대폰으로 한 번 더 지켜요.">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-card">
          <h1 className="text-lg font-semibold text-[var(--text)]">2단계 인증</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            비밀번호가 새도 휴대폰이 없으면 들어올 수 없게 해요. Google Authenticator나 Microsoft Authenticator 같은 OTP 앱을 쓰세요.
          </p>
          {orgRequires && !verified && loaded && (
            <p role="status" className="mt-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--text)]">
              우리 기관은 모든 관리자에게 2단계 인증을 요구해요. 등록을 마치면 관리자 화면으로 들어갈 수 있어요.
            </p>
          )}

          {!loaded ? (
            <p className="mt-5 text-sm text-[var(--muted-foreground)]">확인하는 중…</p>
          ) : verified ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-[var(--positive)]">등록되어 있어요. 로그인할 때마다 코드를 물어봐요.</p>
              {!aal2 ? (
                <Button onClick={() => router.push("/admin/mfa")}>코드 입력하러 가기</Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => router.push("/admin")}>관리자 화면으로</Button>
                  {!required && (
                    <Button variant="outline" onClick={removeFactor} loading={busy}>
                      등록 해제
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : enroll ? (
            <form onSubmit={confirmEnroll} className="mt-5 space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
                <li>휴대폰 OTP 앱에서 &lsquo;QR 코드 스캔&rsquo;을 누르고 아래 그림을 비춰 주세요.</li>
                <li>앱에 새로 생긴 6자리 숫자를 입력해 주세요.</li>
              </ol>
              {/* Supabase가 만든 QR(SVG data URL) — 외부 주소를 불러오지 않는다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="OTP 앱 등록용 QR 코드" width={180} height={180} className="mx-auto rounded-lg bg-white p-2" />
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                스캔이 안 되면 이 키를 직접 입력하세요:{" "}
                <code className="select-all break-all font-mono text-[var(--text)]">{enroll.secret}</code>
              </p>
              <CodeInput value={code} onChange={setCode} />
              <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>
                등록 마치기
              </Button>
            </form>
          ) : (
            <Button className="mt-5" onClick={startEnroll} loading={busy}>
              등록 시작
            </Button>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
              {error}
            </p>
          )}
        </div>

        {isSuper && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">모든 관리자에게 요구하기</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  켜면 등록하지 않은 관리자는 다음 접속 때 등록부터 해야 해요. 켜려면 먼저 내 계정을 등록하고 코드로 로그인해 주세요.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={required}
                aria-label="모든 관리자에게 2단계 인증 요구"
                disabled={busy}
                onClick={() => toggleRequired(!required)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${required ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${required ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          <button type="button" onClick={() => signOut(router)} className="underline">
            로그아웃
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
