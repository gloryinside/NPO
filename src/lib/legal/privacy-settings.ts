import type { PrivacyOfficer } from "./default-templates";

/** orgs.privacy_settings 의 개인정보 보호책임자(개인정보 보호법 제31조 — 지정·공개 의무) */
export function readOfficer(privacySettings: unknown): PrivacyOfficer | null {
  const o = ((privacySettings ?? {}) as { officer?: Record<string, unknown> }).officer;
  if (!o || typeof o.name !== "string" || !o.name.trim()) return null;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { name: o.name.trim(), title: s(o.title), phone: s(o.phone), email: s(o.email) };
}

export function parseOfficer(raw: unknown): { ok: true; value: PrivacyOfficer } | { ok: false; error: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = s(o.name, 40);
  const phone = s(o.phone, 30);
  const email = s(o.email, 100);
  if (!name) return { ok: false, error: "보호책임자 이름을 적어 주세요." };
  if (!phone && !email) return { ok: false, error: "연락처(전화 또는 이메일)를 하나 이상 적어 주세요." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "이메일 형식을 확인해 주세요." };
  return { ok: true, value: { name, title: s(o.title, 40) || null, phone: phone || null, email: email || null } };
}
