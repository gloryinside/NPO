"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OtpLoginForm } from "@/components/donor/otp-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DonorLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
        setError(authError.message);
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

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-semibold text-[var(--text)]">
          후원자 로그인
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          기부 내역이 있는 이메일로 로그인하세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-sm text-[var(--muted-foreground)]"
            >
              이메일
            </Label>
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
            <Label
              htmlFor="password"
              className="text-sm text-[var(--muted-foreground)]"
            >
              비밀번호
            </Label>
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>또는</span>
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
        </div>

        <p className="mb-3 text-center text-sm font-medium" style={{ color: 'var(--text)' }}>
          휴대폰 번호로 간편 로그인
        </p>
        <OtpLoginForm />

        <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
          아직 계정이 없으신가요?{" "}
          <a
            href="/donor/signup"
            className="text-[var(--accent)] hover:underline"
          >
            회원가입
          </a>
        </p>
      </div>
    </div>
  );
}
