"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberCsvImport } from "@/components/admin/member-csv-import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Member, MemberStatus } from "@/types/member";
import type { AccountState } from "@/lib/members/account-state";
import { AccountStateBadge } from "@/components/admin/members/account-state-badge";

type Props = {
  members: Member[];
  total: number;
  initialQuery: string;
  initialStatus: string;
  initialPayMethod?: string;
  initialPromiseType?: string;
  /** member.id → 계정 상태. 키 누락 시 기본 'unlinked' 로 해석. */
  accountStates?: Record<string, AccountState>;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "deceased", label: "사망" },
  { value: "all", label: "전체" },
];

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "활성",
  inactive: "비활성",
  deceased: "사망",
};

function StatusBadge({ status }: { status: MemberStatus }) {
  const styles: Record<MemberStatus, React.CSSProperties> = {
    active: {
      background: "var(--positive-soft)",
      color: "var(--positive)",
    },
    inactive: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    deceased: {
      background: "var(--negative-soft)",
      color: "var(--negative)",
    },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

type NewMemberForm = {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  memberType: string;
  joinPath: string;
  note: string;
};

const EMPTY_FORM: NewMemberForm = {
  name: "",
  phone: "",
  email: "",
  birthDate: "",
  memberType: "individual",
  joinPath: "",
  note: "",
};

function AddMemberDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewMemberForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    (key: keyof NewMemberForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          birthDate: form.birthDate || undefined,
          memberType: form.memberType,
          joinPath: form.joinPath || undefined,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "등록 실패");
      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">후원자 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="add-name" className="text-sm font-medium text-[var(--text)]">
              이름 <span className="text-[var(--negative)]">*</span>
            </label>
            <Input
              id="add-name"
              required
              value={form.name}
              onChange={field("name")}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="add-phone" className="text-sm font-medium text-[var(--text)]">연락처</label>
              <Input
                id="add-phone"
                type="tel"
                value={form.phone}
                onChange={field("phone")}
                placeholder="010-0000-0000"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="add-email" className="text-sm font-medium text-[var(--text)]">이메일</label>
              <Input
                id="add-email"
                type="email"
                value={form.email}
                onChange={field("email")}
                placeholder="name@example.com"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="add-birth" className="text-sm font-medium text-[var(--text)]">생년월일</label>
              <Input
                id="add-birth"
                type="date"
                value={form.birthDate}
                onChange={field("birthDate")}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="add-type" className="text-sm font-medium text-[var(--text)]">구분</label>
              <select
                id="add-type"
                value={form.memberType}
                onChange={field("memberType")}
                title="후원자 구분"
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
              >
                <option value="individual">개인</option>
                <option value="corporate">법인</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="add-join" className="text-sm font-medium text-[var(--text)]">가입 경로</label>
            <Input
              id="add-join"
              value={form.joinPath}
              onChange={field("joinPath")}
              placeholder="방문, 온라인, 지인 소개 등"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="add-note" className="text-sm font-medium text-[var(--text)]">메모</label>
            <textarea
              id="add-note"
              value={form.note}
              onChange={field("note")}
              rows={2}
              placeholder="후원자 관련 메모"
              className={`rounded-lg border px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
            />
          </div>
          {error && (
            <p className="text-sm rounded-lg border px-3 py-2 text-[var(--negative)] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.4)]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[var(--accent)] text-white disabled:opacity-60"
            >
              {saving ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PAY_METHOD_OPTIONS = [
  { value: "", label: "결제방법 전체" },
  { value: "card", label: "카드" },
  { value: "transfer", label: "계좌이체" },
  { value: "cms", label: "CMS" },
  { value: "manual", label: "수기" },
];

const PROMISE_TYPE_OPTIONS = [
  { value: "", label: "후원유형 전체" },
  { value: "regular", label: "정기" },
  { value: "onetime", label: "일시" },
];

export function MemberList({
  members,
  total,
  initialQuery,
  initialStatus,
  initialPayMethod = "",
  initialPromiseType = "",
  accountStates,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [payMethod, setPayMethod] = useState(initialPayMethod);
  const [promiseType, setPromiseType] = useState(initialPromiseType);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const buildUrl = (nextQuery: string, nextStatus: string, nextPayMethod: string, nextPromiseType: string) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextStatus && nextStatus !== "active") params.set("status", nextStatus);
    if (nextPayMethod) params.set("payMethod", nextPayMethod);
    if (nextPromiseType) params.set("promiseType", nextPromiseType);
    const qs = params.toString();
    return qs ? `/admin/members?${qs}` : "/admin/members";
  };

  useEffect(() => {
    // 최초 mount에서는 동기화만 하고 라우팅하지 않음
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildUrl(query, status, payMethod, promiseType));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, payMethod, promiseType]);

  return (
    <div>
      <AddMemberDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => {
          setShowAddDialog(false);
          router.refresh();
        }}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">후원자 관리</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            총 {total.toLocaleString("ko-KR")}명
          </span>
          <MemberCsvImport />
          <a
            href={`/api/admin/export/members?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(status && status !== "active" ? { status } : {}),
              ...(payMethod ? { payMethod } : {}),
              ...(promiseType ? { promiseType } : {}),
            }).toString()}`}
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            CSV 내보내기
          </a>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-[var(--accent)] text-white text-sm px-4 py-1.5 h-auto"
          >
            + 후원자 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <Input
            placeholder="이름, 연락처, 이메일로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className="px-3 py-1.5 text-sm rounded-md border transition-colors"
                style={{
                  background: isActive ? "var(--accent)" : "var(--surface-2)",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  color: isActive ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {/* 결제방법 필터 */}
        <select
          title="결제방법 필터"
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none"
          style={{
            background: payMethod ? "color-mix(in srgb, var(--accent) 10%, var(--surface-2))" : "var(--surface-2)",
            borderColor: payMethod ? "var(--accent)" : "var(--border)",
            color: payMethod ? "var(--accent)" : "var(--muted-foreground)",
          }}
        >
          {PAY_METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {/* 후원유형 필터 */}
        <select
          title="후원유형 필터"
          value={promiseType}
          onChange={(e) => setPromiseType(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none"
          style={{
            background: promiseType ? "color-mix(in srgb, var(--accent) 10%, var(--surface-2))" : "var(--surface-2)",
            borderColor: promiseType ? "var(--accent)" : "var(--border)",
            color: promiseType ? "var(--accent)" : "var(--muted-foreground)",
          }}
        >
          {PROMISE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--border)" }}>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                회원코드
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                이름
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                연락처
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                이메일
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                상태
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                등록일
              </TableHead>
              <TableHead
                style={{ color: "var(--muted-foreground)" }}
                className="text-right"
              >
                액션
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  등록된 후원자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow
                  key={m.id}
                  style={{ borderColor: "var(--border)", cursor: "pointer" }}
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                >
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {m.member_code}
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {m.name}
                      <AccountStateBadge
                        state={accountStates?.[m.id] ?? "unlinked"}
                        compact
                      />
                    </span>
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    {m.phone ?? "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {m.email ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(m.created_at)}
                  </TableCell>
                  <TableCell
                    className="text-right text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    상세 →
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
