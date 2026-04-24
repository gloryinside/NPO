"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useDonorT } from "@/lib/i18n/use-donor-t";

type Initial = {
  name: string;
  phone: string;
  email: string;
  birthDate: string | null;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
};

export function DonorProfileFullForm({ initial }: { initial: Initial }) {
  const t = useDonorT();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const dirty =
    form.name !== initial.name ||
    form.phone !== initial.phone ||
    (form.birthDate ?? "") !== (initial.birthDate ?? "") ||
    form.postalCode !== initial.postalCode ||
    form.addressLine1 !== initial.addressLine1 ||
    form.addressLine2 !== initial.addressLine2;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/donor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          birthDate: form.birthDate || null,
          postalCode: form.postalCode || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "저장 실패");
      }
      setMsg({ type: "ok", text: t("donor.profile.save_ok") });
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "저장 실패",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border p-5 space-y-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* 이메일 (읽기 전용) */}
      <div>
        <Label htmlFor="email">{t("donor.profile.field.email")}</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          readOnly
          disabled
          className="mt-1"
        />
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("donor.profile.email_readonly")}
        </p>
      </div>

      {/* 이름 */}
      <div>
        <Label htmlFor="name">{t("donor.profile.field.name")}</Label>
        <Input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="mt-1"
        />
      </div>

      {/* 연락처·생년월일 2열 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">{t("donor.profile.field.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="010-1234-5678"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="birthDate">
            {t("donor.profile.field.birth_date")}
          </Label>
          <Input
            id="birthDate"
            type="date"
            value={form.birthDate ?? ""}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      {/* 주소 */}
      <div className="space-y-3">
        <Label>{t("donor.profile.field.address")}</Label>
        <Input
          type="text"
          value={form.postalCode}
          onChange={(e) =>
            setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })
          }
          placeholder={t("donor.profile.field.postal_code")}
          maxLength={5}
          inputMode="numeric"
          className="sm:w-40"
        />
        <Input
          type="text"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          placeholder={t("donor.profile.field.address_line1")}
        />
        <Input
          type="text"
          value={form.addressLine2}
          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          placeholder={t("donor.profile.field.address_line2")}
        />
      </div>

      {msg && (
        <div
          role="alert"
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background:
              msg.type === "ok" ? "var(--positive-soft)" : "var(--negative-soft)",
            color: msg.type === "ok" ? "var(--positive)" : "var(--negative)",
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={!dirty || busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
