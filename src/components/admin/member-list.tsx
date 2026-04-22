"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { PageHeader, type PageHeaderTab } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { FilterBar, FilterDropdown } from "@/components/common/filter-bar";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailDrawer } from "@/components/common/detail-drawer";

type Props = {
  members: Member[];
  total: number;
  initialQuery: string;
  initialStatus: string;
  initialPayMethod?: string;
  initialPromiseType?: string;
  /** member.id → 계정 상태. 키 누락 시 기본 'unlinked' 로 해석. */
  accountStates?: Record<string, AccountState>;
  stats: {
    activeCount: number;
    newCount: number;
    churnRiskCount: number;
  };
  /** PageHeader에 렌더할 탭 (외부에서 주입). 없으면 미렌더. */
  tabs?: PageHeaderTab[];
  activeTab?: string;
};

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

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "inactive", label: "비활성" },
  { value: "deceased", label: "사망" },
  { value: "all", label: "전체" },
];

const PAY_METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "card", label: "카드" },
  { value: "transfer", label: "계좌이체" },
  { value: "cms", label: "CMS" },
  { value: "manual", label: "수기" },
];

const PROMISE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
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
  stats,
  tabs,
  activeTab,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [payMethod, setPayMethod] = useState(initialPayMethod);
  const [promiseType, setPromiseType] = useState(initialPromiseType);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Member | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const buildUrl = (nextQuery: string, nextStatus: string, nextPayMethod: string, nextPromiseType: string) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextStatus && nextStatus !== "active") params.set("status", nextStatus);
    if (nextPayMethod) params.set("payMethod", nextPayMethod);
    if (nextPromiseType) params.set("promiseType", nextPromiseType);
    // 탭 쿼리 유지 — 검색/필터 변경 시에도 현재 탭을 지우지 않음
    if (activeTab && activeTab !== "all") params.set("tab", activeTab);
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

  const hasActiveFilters =
    !!query || (status !== "" && status !== "active") || !!payMethod || !!promiseType;

  // status 필터 표시값: 'active'는 기본값이므로 '미선택'(null)로 취급
  const statusFilterValue: string | null =
    status && status !== "active" ? status : null;

  const columns: DataTableColumn<Member>[] = [
    {
      key: "member_code",
      header: "회원코드",
      width: "140px",
      render: (m) => (
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
          {m.member_code}
        </span>
      ),
    },
    {
      key: "name",
      header: "이름",
      render: (m) => (
        <span className="font-medium text-[var(--text)]">{m.name}</span>
      ),
    },
    {
      key: "phone",
      header: "연락처",
      width: "140px",
      render: (m) => (
        <span className="text-[var(--text)]">{m.phone ?? "-"}</span>
      ),
    },
    {
      key: "email",
      header: "이메일",
      render: (m) => (
        <span className="text-[var(--muted-foreground)]">{m.email ?? "-"}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      width: "80px",
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: "account_state",
      header: "계정",
      width: "110px",
      render: (m) => (
        <AccountStateBadge
          state={accountStates?.[m.id] ?? "unlinked"}
          compact
        />
      ),
    },
    {
      key: "created_at",
      header: "등록일",
      width: "110px",
      render: (m) => (
        <span className="text-[var(--muted-foreground)]">
          {formatDate(m.created_at)}
        </span>
      ),
    },
  ];

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

      <PageHeader
        title="회원 관리"
        description={`후원자 회원 정보와 약정을 관리합니다. 총 ${total.toLocaleString(
          "ko-KR"
        )}명`}
        stats={
          <>
            <StatCard
              label="활성 회원"
              value={`${stats.activeCount.toLocaleString("ko-KR")}명`}
            />
            <StatCard
              label="신규 (30일)"
              value={`${stats.newCount.toLocaleString("ko-KR")}명`}
            />
            <StatCard
              label="이탈 위험"
              value={`${stats.churnRiskCount.toLocaleString("ko-KR")}명`}
              tone={stats.churnRiskCount > 0 ? "warning" : "default"}
            />
          </>
        }
        actions={
          <>
            <MemberCsvImport />
            <a
              href={`/api/admin/export/members?${new URLSearchParams({
                ...(query ? { q: query } : {}),
                ...(status && status !== "active" ? { status } : {}),
                ...(payMethod ? { payMethod } : {}),
                ...(promiseType ? { promiseType } : {}),
              }).toString()}`}
              className="inline-flex items-center rounded-md border bg-[var(--surface-2)] border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
            >
              CSV 내보내기
            </a>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
            >
              + 후원자 등록
            </Button>
          </>
        }
        tabs={tabs}
        activeTab={activeTab}
      />

      <FilterBar
        searchPlaceholder="이름, 연락처, 이메일로 검색"
        searchValue={query}
        onSearchChange={setQuery}
        filters={
          <>
            <FilterDropdown
              label="상태"
              value={statusFilterValue}
              options={STATUS_FILTER_OPTIONS}
              onChange={(v) => setStatus(v ?? "active")}
            />
            <FilterDropdown
              label="결제방법"
              value={payMethod || null}
              options={PAY_METHOD_OPTIONS}
              onChange={(v) => setPayMethod(v ?? "")}
            />
            <FilterDropdown
              label="후원유형"
              value={promiseType || null}
              options={PROMISE_TYPE_OPTIONS}
              onChange={(v) => setPromiseType(v ?? "")}
            />
          </>
        }
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setQuery("");
          setStatus("active");
          setPayMethod("");
          setPromiseType("");
        }}
      />

      <DataTable<Member>
        columns={columns}
        rows={members}
        rowKey={(m) => m.id}
        emptyMessage="등록된 후원자가 없습니다."
        onRowClick={(m) => setDetailTarget(m)}
        rowActions={(m) => (
          <a
            href={`/admin/members/${m.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            상세
          </a>
        )}
      />

      <DetailDrawer
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? detailTarget.name : ""}
        subtitle={
          detailTarget ? `회원코드 ${detailTarget.member_code}` : undefined
        }
        footer={
          detailTarget && (
            <div className="flex justify-end">
              <a
                href={`/admin/members/${detailTarget.id}`}
                className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                회원 프로필 열기 →
              </a>
            </div>
          )
        }
      >
        {detailTarget && (
          <div className="flex flex-col gap-4 text-[13px]">
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                기본 정보
              </h3>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
                <dt className="text-[var(--muted-foreground)]">이름</dt>
                <dd className="font-medium text-[var(--text)]">
                  {detailTarget.name}
                </dd>
                <dt className="text-[var(--muted-foreground)]">회원코드</dt>
                <dd className="font-mono text-[12px] text-[var(--text)]">
                  {detailTarget.member_code}
                </dd>
                <dt className="text-[var(--muted-foreground)]">연락처</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.phone ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">이메일</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.email ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">구분</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.member_type === "corporate" ? "법인" : "개인"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">상태</dt>
                <dd>
                  <StatusBadge status={detailTarget.status} />
                </dd>
                <dt className="text-[var(--muted-foreground)]">계정</dt>
                <dd>
                  <AccountStateBadge
                    state={accountStates?.[detailTarget.id] ?? "unlinked"}
                  />
                </dd>
                <dt className="text-[var(--muted-foreground)]">가입경로</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.join_path ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">등록일</dt>
                <dd className="text-[var(--text)]">
                  {formatDate(detailTarget.created_at)}
                </dd>
              </dl>
            </section>
            {detailTarget.note && (
              <section>
                <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                  메모
                </h3>
                <p className="whitespace-pre-wrap text-[var(--text)]">
                  {detailTarget.note}
                </p>
              </section>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
