"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/brand/auth-shell";

export function LoginForm({ notice }: { notice?: string | null } = {}) {
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

      router.push("/admin");
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Admin Console" tagline="후원관리 관리자 계정으로 로그인하세요.">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-card">
        <h1 className="sr-only">관리자 로그인</h1>
        {notice && (
          <p role="alert" className="mb-4 rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--text)]">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-sm font-medium text-[var(--text)]"
            >
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="text-[var(--text)] placeholder:text-[var(--muted-2)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-[var(--text)]"
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
              className="text-[var(--text)] placeholder:text-[var(--muted-2)]"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--negative)]">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>
          <p className="text-center text-xs">
            <a
              href="/admin/password/forgot"
              className="text-[var(--muted-foreground)] hover:underline"
            >
              비밀번호를 잊으셨나요?
            </a>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
