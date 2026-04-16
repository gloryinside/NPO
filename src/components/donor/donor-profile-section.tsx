"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Member } from "@/types/member";

type Props = {
  member: Pick<Member, "id" | "name" | "phone" | "email" | "birth_date">;
};

type FormState = {
  name: string;
  phone: string;
  birthDate: string;
};

function toForm(m: Props["member"]): FormState {
  return {
    name: m.name ?? "",
    phone: m.phone ?? "",
    birthDate: m.birth_date?.slice(0, 10) ?? "",
  };
}

export function DonorProfileSection({ member }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(toForm(member));
  const [saved, setSaved] = useState(toForm(member));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function startEdit() {
    setForm(saved);
    setError(null);
    setSuccess(false);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(saved);
    setError(null);
    setEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/donor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          birthDate: form.birthDate || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      setSaved(form);
      setSuccess(true);
      setEditing(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  const rowStyle = {
    borderTop: "1px solid var(--border)",
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          개인정보
        </h2>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={startEdit}
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            편집
          </Button>
        )}
      </div>

      <div
        className="rounded-lg border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {!editing ? (
          <dl>
            {[
              { label: "이름", value: saved.name || "-" },
              { label: "이메일", value: member.email || "-" },
              { label: "연락처", value: saved.phone || "-" },
              { label: "생년월일", value: saved.birthDate || "-" },
            ].map((row, idx) => (
              <div
                key={row.label}
                className="flex items-center px-4 py-3"
                style={idx === 0 ? undefined : rowStyle}
              >
                <dt
                  className="w-24 text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {row.label}
                </dt>
                <dd
                  className="flex-1 text-sm"
                  style={{ color: "var(--text)" }}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-name" style={{ color: "var(--text)" }}>
                이름 <span style={{ color: "var(--negative)" }}>*</span>
              </Label>
              <Input
                id="dp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label style={{ color: "var(--muted-foreground)" }}>
                이메일
              </Label>
              <Input
                value={member.email ?? ""}
                disabled
                style={{ ...inputStyle, opacity: 0.6 }}
              />
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                이메일은 로그인 계정과 연결되어 변경할 수 없습니다.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-phone" style={{ color: "var(--text)" }}>
                연락처
              </Label>
              <Input
                id="dp-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="010-0000-0000"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="dp-birth" style={{ color: "var(--text)" }}>
                생년월일
              </Label>
              <Input
                id="dp-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--negative)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={cancelEdit}
                style={{ color: "var(--muted-foreground)" }}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={loading}
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {loading ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {success && (
        <p className="mt-2 text-sm" style={{ color: "var(--positive, #22c55e)" }}>
          개인정보가 저장되었습니다.
        </p>
      )}
    </section>
  );
}
