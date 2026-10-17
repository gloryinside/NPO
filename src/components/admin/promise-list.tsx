"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/common/data-table";
import { DetailDrawer } from "@/components/common/detail-drawer";
import {
  FilterBar,
  FilterDropdown,
} from "@/components/common/filter-bar";
import type {
  PromiseStatus,
  PromiseType,
  PromiseWithRelations,
} from "@/types/promise";
import { formatDate, formatKRW as formatAmount } from "@/lib/format";
import { PROMISE_STATUS_LABEL, PROMISE_TYPE_LABEL } from "@/lib/labels";
import { ActionMenu, AmountDialog, CancelDialog, ConfirmActionDialog, SuspendDialog, type ActionType, type ActiveAction } from "./promise-actions";
import { AddPromiseDialog } from "./promise-add-dialog";


type Props = {
  promises: PromiseWithRelations[];
  total: number;
  initialStatus: string;
  stats: {
    activeCount: number;
    cancelScheduledCount: number;
    overdueCount: number;
  };
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "active", label: "진행중" },
  { value: "suspended", label: "일시중지" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "해지" },
  { value: "all", label: "전체" },
];

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "var(--positive-soft)", color: "var(--positive)" },
    suspended: { background: "var(--warning-soft)", color: "var(--warning)" },
    cancelled: { background: "var(--negative-soft)", color: "var(--negative)" },
    completed: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    pending_billing: { background: "var(--warning-soft)", color: "var(--warning)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {PROMISE_STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseTypeBadge({ type }: { type: PromiseType }) {
  const styles: Record<PromiseType, React.CSSProperties> = {
    regular: { background: "var(--info-soft)", color: "var(--info)" },
    onetime: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
  };
  return (
    <Badge style={styles[type]} className="border-0 font-medium">
      {PROMISE_TYPE_LABEL[type]}
    </Badge>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PromiseList({ promises, total, initialStatus, stats }: Props) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [active, setActive] = useState<ActiveAction | null>(null);
  const [detailTarget, setDetailTarget] = useState<PromiseWithRelations | null>(null);

  // FilterBar state (client-side narrowing on top of server-filtered list)
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PromiseType | null>(null);

  const filteredPromises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return promises.filter((p) => {
      if (q) {
        const name = (p.members?.name ?? "").toLowerCase();
        const code = (p.promise_code ?? "").toLowerCase();
        const campaign = (p.campaigns?.title ?? "").toLowerCase();
        const memberCode = (p.members?.member_code ?? "").toLowerCase();
        if (
          !name.includes(q) &&
          !code.includes(q) &&
          !campaign.includes(q) &&
          !memberCode.includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter && p.type !== typeFilter) return false;
      return true;
    });
  }, [promises, searchQuery, typeFilter]);

  const hasActiveFilters = !!(searchQuery || typeFilter);
  function resetFilters() {
    setSearchQuery("");
    setTypeFilter(null);
  }

  const openAction = (promise: PromiseWithRelations, action: ActionType) => {
    setActive({ promise, action });
  };

  const closeAction = () => setActive(null);

  const doneAction = () => {
    setActive(null);
    setDetailTarget(null);
    router.refresh();
  };

  const dialogTitle: Record<ActionType, string> = {
    amount: "후원 금액 변경",
    suspend: "정기후원 일시정지",
    cancel: "정기후원 해지",
    resume: "정기후원 다시 시작",
    complete: "정기후원 완료 처리",
  };

  const columns: DataTableColumn<PromiseWithRelations>[] = [
    {
      key: "promise_code",
      header: "후원 번호",
      sortValue: (p) => p.promise_code,
      width: "140px",
      render: (p) => (
        <span className="font-mono text-[12px] text-[var(--muted-foreground)]">
          {p.promise_code}
        </span>
      ),
    },
    {
      key: "member",
      header: "후원자",
      sortValue: (p) => p.members?.name ?? null,
      render: (p) => (
        <span className="text-[var(--text)]">{p.members?.name ?? "-"}</span>
      ),
    },
    {
      key: "campaign",
      header: "캠페인",
      sortValue: (p) => p.campaigns?.title ?? null,
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {p.campaigns?.title ?? "-"}
        </span>
      ),
    },
    {
      key: "type",
      header: "유형",
      sortValue: (p) => p.type,
      width: "70px",
      render: (p) => <PromiseTypeBadge type={p.type} />,
    },
    {
      key: "amount",
      header: "금액",
      sortValue: (p) => Number(p.amount ?? 0),
      align: "right",
      width: "120px",
      render: (p) => (
        <span className="font-medium text-[var(--text)]">
          {formatAmount(p.amount)}
        </span>
      ),
    },
    {
      key: "pay_day",
      header: "결제일",
      sortValue: (p) => p.pay_day ?? null,
      hint: "매달 자동결제가 되는 날짜",
      width: "100px",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
        </span>
      ),
    },
    {
      key: "started_at",
      header: "시작일",
      sortValue: (p) => p.started_at ?? null,
      width: "110px",
      render: (p) => (
        <span className="text-[var(--muted-foreground)]">
          {formatDate(p.started_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      sortValue: (p) => p.status,
      width: "100px",
      render: (p) => <PromiseStatusBadge status={p.status} />,
    },
  ];

  const pageTabs = STATUS_TABS.map((tab) => ({
    key: tab.value,
    label: tab.label,
    href:
      tab.value === "active"
        ? "/admin/promises"
        : `/admin/promises?status=${tab.value}`,
  }));

  const activeTabKey = initialStatus || "active";

  return (
    <div>
      <AddPromiseDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); router.refresh(); }}
      />

      {/* Action dialog */}
      <Dialog open={active !== null} onOpenChange={(v) => { if (!v) closeAction(); }}>
        {active && (
          <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
            <DialogHeader>
              <DialogTitle className="text-[var(--text)]">
                {dialogTitle[active.action]}
              </DialogTitle>
            </DialogHeader>
            {active.action === "amount" && (
              <AmountDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {active.action === "suspend" && (
              <SuspendDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {active.action === "cancel" && (
              <CancelDialog promise={active.promise} onClose={closeAction} onDone={doneAction} />
            )}
            {(active.action === "resume" || active.action === "complete") && (
              <ConfirmActionDialog
                promise={active.promise}
                action={active.action}
                onClose={closeAction}
                onDone={doneAction}
              />
            )}
          </DialogContent>
        )}
      </Dialog>

      <PageHeader
        title="정기후원 관리"
        description={`매달 자동결제되는 정기후원과 일시후원 약속을 확인하고 관리해요. 총 ${total.toLocaleString(
          "ko-KR"
        )}건`}
        stats={
          <>
            <StatCard
              label="진행 중"
              value={`${stats.activeCount.toLocaleString("ko-KR")}건`}
            />
            <StatCard
              label="해지 예정"
              value={`${stats.cancelScheduledCount.toLocaleString("ko-KR")}건`}
              tone={stats.cancelScheduledCount > 0 ? "warning" : "default"}
            />
            <StatCard
              label="연체"
              value={`${stats.overdueCount.toLocaleString("ko-KR")}건`}
              tone={stats.overdueCount > 0 ? "negative" : "default"}
            />
          </>
        }
        actions={
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-auto bg-[var(--accent)] px-4 py-1.5 text-[13px] text-white"
          >
            + 정기후원 등록
          </Button>
        }
        tabs={pageTabs}
        activeTab={activeTabKey}
      />

      <FilterBar
        searchPlaceholder="후원자 이름·후원 번호·캠페인으로 찾기"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={
          <FilterDropdown<PromiseType>
            label="유형"
            value={typeFilter}
            options={[
              { value: "regular", label: "정기" },
              { value: "onetime", label: "일시" },
            ]}
            onChange={setTypeFilter}
          />
        }
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      <DataTable
        columns={columns}
        rows={filteredPromises}
        rowKey={(p) => p.id}
        emptyMessage="아직 정기후원이 없어요."
        emptyHint="후원자가 정기후원을 신청하면 여기에 생깁니다. 전화·서면으로 받은 정기후원은 오른쪽 위에서 직접 등록할 수 있어요."
        caption="정기후원 목록"
        emptyIllustration="promises"
        onRowClick={(p) => setDetailTarget(p)}
        rowActions={(p) => <ActionMenu promise={p} onAction={openAction} />}
      />

      <DetailDrawer
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="정기후원 상세"
        subtitle={
          detailTarget
            ? `${detailTarget.members?.name ?? "-"} · ${formatAmount(
                detailTarget.amount
              )}`
            : undefined
        }
        footer={
          detailTarget && detailTarget.member_id ? (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (detailTarget.member_id) {
                    router.push(`/admin/members/${detailTarget.member_id}`);
                  }
                }}
                className="h-auto bg-[var(--accent)] px-3 py-1.5 text-[12px] text-white"
              >
                후원자 프로필 열기
              </Button>
            </div>
          ) : undefined
        }
      >
        {detailTarget && (
          <div className="flex flex-col gap-4 text-[13px]">
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                후원 정보
              </h3>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
                <dt className="text-[var(--muted-foreground)]">후원 번호</dt>
                <dd className="font-mono text-[12px] text-[var(--text)]">
                  {detailTarget.promise_code}
                </dd>
                <dt className="text-[var(--muted-foreground)]">후원자</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.members?.name ?? "-"}
                  {detailTarget.members?.member_code && (
                    <span className="ml-1 text-[11px] text-[var(--muted-foreground)]">
                      ({detailTarget.members.member_code})
                    </span>
                  )}
                </dd>
                <dt className="text-[var(--muted-foreground)]">캠페인</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.campaigns?.title ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">유형</dt>
                <dd>
                  <PromiseTypeBadge type={detailTarget.type} />
                </dd>
                <dt className="text-[var(--muted-foreground)]">금액</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {formatAmount(detailTarget.amount)}
                </dd>
                <dt className="text-[var(--muted-foreground)]">결제일</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.pay_day ? `매월 ${detailTarget.pay_day}일` : "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">결제수단</dt>
                <dd className="text-[var(--text)]">
                  {detailTarget.pay_method ?? "-"}
                </dd>
                <dt className="text-[var(--muted-foreground)]">상태</dt>
                <dd>
                  <PromiseStatusBadge status={detailTarget.status} />
                </dd>
                {detailTarget.started_at && (
                  <>
                    <dt className="text-[var(--muted-foreground)]">시작일</dt>
                    <dd className="text-[var(--text)]">
                      {formatDate(detailTarget.started_at)}
                    </dd>
                  </>
                )}
                {detailTarget.ended_at && (
                  <>
                    <dt className="text-[var(--muted-foreground)]">종료일</dt>
                    <dd className="text-[var(--text)]">
                      {formatDate(detailTarget.ended_at)}
                    </dd>
                  </>
                )}
              </dl>
            </section>

            <section className="border-t border-[var(--border)] pt-3">
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[var(--muted-foreground)]">
                빠른 작업
              </h3>
              <div className="flex flex-wrap gap-2">
                {(detailTarget.status === "active" ||
                  detailTarget.status === "suspended") && (
                  <button
                    type="button"
                    onClick={() => openAction(detailTarget, "amount")}
                    className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--text)] hover:bg-[var(--surface)]"
                  >
                    금액 변경
                  </button>
                )}
                {detailTarget.status === "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "suspend")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--warning)" }}
                    >
                      일시정지
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "complete")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--surface)]"
                    >
                      완료 처리
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "cancel")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--negative)" }}
                    >
                      해지
                    </button>
                  </>
                )}
                {detailTarget.status === "suspended" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "resume")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--positive)" }}
                    >
                      재개
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction(detailTarget, "cancel")}
                      className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface)]"
                      style={{ color: "var(--negative)" }}
                    >
                      해지
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
