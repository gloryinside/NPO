"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DONATION_TYPE_CODES } from "@/lib/receipt/validation";

type OrgProfile = {
  name: string;
  business_no: string | null;
  tagline: string | null;
  about: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  show_stats: boolean;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  representative_name?: string | null;
  donee_type?: string | null;
  donee_legal_basis?: string | null;
  donee_code?: string | null;
  donation_type_code?: string | null;
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
    bank_name: initialData.bank_name ?? "",
    bank_account: initialData.bank_account ?? "",
    account_holder: initialData.account_holder ?? "",
    representative_name: initialData.representative_name ?? "",
    donee_type: initialData.donee_type ?? "",
    donee_legal_basis: initialData.donee_legal_basis ?? "",
    donee_code: initialData.donee_code ?? "",
    donation_type_code: initialData.donation_type_code ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const field =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
          bank_name: form.bank_name || null,
          bank_account: form.bank_account || null,
          account_holder: form.account_holder || null,
          representative_name: form.representative_name || null,
          donee_type: form.donee_type || null,
          donee_legal_basis: form.donee_legal_basis || null,
          donee_code: form.donee_code || null,
          donation_type_code: form.donation_type_code || null,
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

      {/* 기부금영수증 법정 기재사항 — 비어 있으면 영수증을 발급할 수 없다 */}
      <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold text-[var(--text)]">기부금영수증 기재사항</legend>
        <div>
          <label style={labelStyle}>대표자 성명 *</label>
          <Input value={form.representative_name} onChange={field("representative_name")} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>기부금 단체 구분</label>
          <Input value={form.donee_type} onChange={field("donee_type")} placeholder="예: 사회복지법인, 공익법인" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>지정 근거 법령</label>
          <Input value={form.donee_legal_basis} onChange={field("donee_legal_basis")} placeholder="예: 법인세법 제24조제3항제1호" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>국세청 기부금단체코드</label>
          <Input value={form.donee_code} onChange={field("donee_code")} placeholder="알파벳 3자리 (홈택스 기부금단체코드표)" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>기부금 유형 코드 *</label>
          <select
            value={form.donation_type_code}
            onChange={field("donation_type_code")}
            className="h-10 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
          >
            <option value="">선택하세요</option>
            {Object.entries(DONATION_TYPE_CODES).map(([code, label]) => (
              <option key={code} value={code}>{code} · {label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            기관이 받는 기부금의 세법상 유형입니다. 영수증과 연말정산 간소화 자료에 들어갑니다(소득세법 시행규칙 별지 제45호서식).
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          단체명·사업자등록번호·소재지·대표자는 영수증 필수 기재사항입니다. 비어 있으면 영수증 발급이 중단됩니다.
        </p>
      </fieldset>

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

      {/* 계좌 정보 */}
      <div>
        <label style={{ ...labelStyle, marginBottom: "0.75rem" }}>
          계좌 정보
        </label>
        <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
          계좌이체·CMS 후원 신청 시 공개 캠페인 페이지에 안내됩니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={{ ...labelStyle, fontSize: "0.8125rem" }}>은행명</label>
            <Input
              value={form.bank_name}
              onChange={field("bank_name")}
              placeholder="국민은행"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: "0.8125rem" }}>계좌번호</label>
            <Input
              value={form.bank_account}
              onChange={field("bank_account")}
              placeholder="000-0000-0000-00"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: "0.8125rem" }}>예금주</label>
            <Input
              value={form.account_holder}
              onChange={field("account_holder")}
              placeholder="사단법인 ○○"
              style={inputStyle}
            />
          </div>
        </div>
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
