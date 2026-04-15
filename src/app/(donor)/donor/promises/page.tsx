import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import type {
  PromiseStatus,
  PromiseType,
  PromiseWithRelations,
} from "@/types/promise";

const STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "rgba(34,197,94,0.15)", color: "var(--positive)" },
    suspended: {
      background: "rgba(245,158,11,0.15)",
      color: "var(--warning)",
    },
    cancelled: {
      background: "rgba(239,68,68,0.15)",
      color: "var(--negative)",
    },
    completed: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function formatAmount(value: number | null | undefined) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

const STATUS_ORDER: PromiseStatus[] = [
  "active",
  "suspended",
  "completed",
  "cancelled",
];

export default async function DonorPromisesPage() {
  const { member } = await requireDonorSession();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("promises")
    .select("*, campaigns(id, title)")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("created_at", { ascending: false });

  const all = (data as unknown as PromiseWithRelations[]) ?? [];
  const sorted = [...all].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          내 약정
        </h1>
        <div
          className="text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          총 {sorted.length.toLocaleString("ko-KR")}건
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          className="rounded-lg border p-12 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
          }}
        >
          등록된 약정이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border p-5"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-base font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {p.campaigns?.title ?? "일반 후원"}
                    </span>
                    <PromiseStatusBadge status={p.status} />
                    <span
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {TYPE_LABEL[p.type]}
                    </span>
                  </div>
                  <div
                    className="mt-2 text-xs font-mono"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.promise_code}
                  </div>
                  <div
                    className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <div>
                      <span className="block text-xs">약정 금액</span>
                      <span
                        className="font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {formatAmount(p.amount)}
                      </span>
                    </div>
                    {p.type === "regular" && (
                      <div>
                        <span className="block text-xs">결제일</span>
                        <span
                          className="font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          매월 {p.pay_day ?? "-"}일
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="block text-xs">시작일</span>
                      <span
                        className="font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {formatDate(p.started_at)}
                      </span>
                    </div>
                    {p.ended_at && (
                      <div>
                        <span className="block text-xs">종료일</span>
                        <span
                          className="font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {formatDate(p.ended_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
