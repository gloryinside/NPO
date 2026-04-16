"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Member } from "@/types/member";

type Props = {
  member: Member;
};

type EditForm = {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  memberType: string;
  status: string;
  joinPath: string;
  note: string;
  /** "" = 변경 없음, "CLEAR" = 삭제, 그 외 = 새 13자리 값 */
  idNumber: string;
};

function toForm(m: Member): EditForm {
  return {
    name: m.name,
    phone: m.phone ?? "",
    email: m.email ?? "",
    birthDate: m.birth_date?.slice(0, 10) ?? "",
    memberType: m.member_type,
    status: m.status,
    joinPath: m.join_path ?? "",
    note: m.note ?? "",
    idNumber: "",
  };
}

export function MemberEditForm({ member }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(toForm(member));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const field =
    (key: keyof EditForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  function cancelEdit() {
    setForm(toForm(member));
    setEditing(false);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("이름은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        birthDate: form.birthDate || null,
        memberType: form.memberType,
        status: form.status,
        joinPath: form.joinPath || null,
        note: form.note || null,
      };
      // idNumber: "" = 변경 없음 (전송 안 함), "CLEAR" = 삭제, 그 외 = 값 설정
      if (form.idNumber === "CLEAR") {
        payload.idNumber = null;
      } else if (form.idNumber.trim()) {
        payload.idNumber = form.idNumber.replace(/-/g, "").trim();
      }

      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setSuccess(true);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";

  if (!editing) {
    const infoRows: Array<{ label: string; value: React.ReactNode }> = [
      { label: "연락처", value: member.phone ?? "-" },
      { label: "이메일", value: member.email ?? "-" },
      {
        label: "생년월일",
        value: member.birth_date
          ? new Date(member.birth_date).toLocaleDateString("ko-KR")
          : "-",
      },
      {
        label: "회원유형",
        value: member.member_type === "individual" ? "개인" : "법인",
      },
      { label: "가입경로", value: member.join_path ?? "-" },
      { label: "메모", value: member.note ?? "-" },
      {
        label: "주민등록번호",
        value: member.id_number_encrypted ? (
          <span style={{ color: "var(--positive)" }}>설정됨 (암호화)</span>
        ) : (
          <span style={{ color: "var(--muted-foreground)" }}>미설정</span>
        ),
      },
    ];

    return (
      <div
        className="rounded-lg border p-6"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
            기본 정보
          </h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
            className="text-sm h-8 px-3 border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
          >
            편집
          </Button>
        </div>
        {success && (
          <p className="text-sm mb-4" style={{ color: "var(--positive)" }}>
            저장되었습니다.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infoRows.map((row) => (
            <div key={row.label} className="flex gap-4">
              <div
                className="w-20 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {row.label}
              </div>
              <div className="text-sm" style={{ color: "var(--text)" }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-6"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h2 className="text-sm font-medium mb-4" style={{ color: "var(--muted-foreground)" }}>
        기본 정보 편집
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 이름 + 상태 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-name" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              이름 <span style={{ color: "var(--negative)" }}>*</span>
            </label>
            <Input
              id="edit-name"
              required
              value={form.name}
              onChange={field("name")}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-status" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              상태
            </label>
            <select
              id="edit-status"
              title="후원자 상태"
              value={form.status}
              onChange={field("status")}
              className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="deceased">사망</option>
            </select>
          </div>
        </div>

        {/* 연락처 + 이메일 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-phone" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              연락처
            </label>
            <Input
              id="edit-phone"
              type="tel"
              value={form.phone}
              onChange={field("phone")}
              placeholder="010-0000-0000"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-email" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              이메일
            </label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={field("email")}
              placeholder="name@example.com"
              className={inputCls}
            />
          </div>
        </div>

        {/* 생년월일 + 회원유형 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-birth" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              생년월일
            </label>
            <Input
              id="edit-birth"
              type="date"
              value={form.birthDate}
              onChange={field("birthDate")}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-type" className="text-sm font-medium" style={{ color: "var(--text)" }}>
              회원 유형
            </label>
            <select
              id="edit-type"
              title="회원 유형"
              value={form.memberType}
              onChange={field("memberType")}
              className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
            >
              <option value="individual">개인</option>
              <option value="corporate">법인</option>
            </select>
          </div>
        </div>

        {/* 가입 경로 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-join" className="text-sm font-medium" style={{ color: "var(--text)" }}>
            가입 경로
          </label>
          <Input
            id="edit-join"
            value={form.joinPath}
            onChange={field("joinPath")}
            placeholder="방문, 온라인, 지인 소개 등"
            className={inputCls}
          />
        </div>

        {/* 주민등록번호 (기부금 영수증용, 암호화 저장) */}
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-idnumber" className="text-sm font-medium" style={{ color: "var(--text)" }}>
            주민등록번호
            <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
              (기부금 영수증 발급용, 서버에 AES 암호화 저장)
            </span>
          </label>
          <Input
            id="edit-idnumber"
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={form.idNumber === "CLEAR" ? "" : form.idNumber}
            onChange={field("idNumber")}
            placeholder={
              member.id_number_encrypted
                ? "••••••-•••••••  (새 값 입력 시 덮어씀)"
                : "13자리 숫자 (- 생략 가능)"
            }
            className={inputCls}
          />
          {member.id_number_encrypted && (
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  idNumber: prev.idNumber === "CLEAR" ? "" : "CLEAR",
                }))
              }
              className="self-start text-xs underline mt-1"
              style={{
                color:
                  form.idNumber === "CLEAR"
                    ? "var(--negative)"
                    : "var(--muted-foreground)",
              }}
            >
              {form.idNumber === "CLEAR"
                ? "삭제 취소"
                : "저장된 주민등록번호 삭제"}
            </button>
          )}
        </div>

        {/* 메모 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-note" className="text-sm font-medium" style={{ color: "var(--text)" }}>
            메모
          </label>
          <textarea
            id="edit-note"
            value={form.note}
            onChange={field("note")}
            rows={3}
            placeholder="후원자 관련 메모"
            className={`rounded-lg border px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--negative)" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={cancelEdit}
            className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[var(--accent)] text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  );
}
