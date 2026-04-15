"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type OrgProfile = {
  name: string;
  business_no: string | null;
  tagline: string | null;
  about: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  show_stats: boolean;
};

export function OrgProfileForm({ initialData }: { initialData: OrgProfile }) {
  const [form, setForm] = useState({
    name: initialData.name,
    business_no: initialData.business_no ?? "",
    tagline: initialData.tagline ?? "",
    about: initialData.about ?? "",
    contact_email: initialData.contact_email ?? "",
    contact_phone: initialData.contact_phone ?? "",
    address: initialData.address ?? "",
    show_stats: initialData.show_stats,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const field =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          business_no: form.business_no || null,
          tagline: form.tagline || null,
          about: form.about || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          address: form.address || null,
          show_stats: form.show_stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "저장에 실패했습니다.");
      }
      setMessage({ type: "success", text: "기관 정보가 저장되었습니다." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
      });
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text)",
    marginBottom: "0.375rem",
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label style={labelStyle}>
          기관명 <span style={{ color: "var(--negative)" }}>*</span>
        </label>
        <Input
          value={form.name}
          onChange={field("name")}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>사업자등록번호</label>
        <Input
          value={form.business_no}
          onChange={field("business_no")}
          placeholder="000-00-00000"
          style={inputStyle}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          기부금 영수증 PDF에 표시됩니다.
        </p>
      </div>

      <div>
        <label style={labelStyle}>슬로건</label>
        <Input
          value={form.tagline}
          onChange={field("tagline")}
          placeholder="함께하는 나눔, 변화의 시작"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>기관 소개</label>
        <textarea
          value={form.about}
          onChange={field("about")}
          rows={4}
          placeholder="기관에 대한 간략한 소개를 입력하세요."
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>대표 이메일</label>
          <Input
            type="email"
            value={form.contact_email}
            onChange={field("contact_email")}
            placeholder="contact@org.kr"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>대표 전화</label>
          <Input
            type="tel"
            value={form.contact_phone}
            onChange={field("contact_phone")}
            placeholder="02-1234-5678"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>주소</label>
        <Input
          value={form.address}
          onChange={field("address")}
          placeholder="서울특별시 강남구 ..."
          style={inputStyle}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="show_stats"
          checked={form.show_stats}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, show_stats: e.target.checked }))
          }
          style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
        />
        <label
          htmlFor="show_stats"
          className="text-sm cursor-pointer"
          style={{ color: "var(--text)" }}
        >
          공개 캠페인 페이지에 누적 통계 표시
        </label>
      </div>

      {message && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            background:
              message.type === "success"
                ? "rgba(34,197,94,0.1)"
                : "rgba(239,68,68,0.1)",
            borderColor:
              message.type === "success"
                ? "rgba(34,197,94,0.4)"
                : "rgba(239,68,68,0.4)",
            color:
              message.type === "success" ? "var(--positive)" : "var(--negative)",
          }}
        >
          {message.text}
        </div>
      )}

      <div>
        <Button
          type="submit"
          disabled={saving}
          style={{
            background: "var(--accent)",
            color: "#fff",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
