import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/context";
import { formatKRW, formatDateKR } from "@/lib/format";

type RecentPaymentRow = {
  id: string;
  amount: number | null;
  pay_date: string | null;
  members: { id: string; name: string } | null;
  campaigns: { id: string; title: string } | null;
};

function getCurrentMonthRange(): { firstDay: string; nextFirstDay: string } {
  // KST 기준 이번 달 범위를 "YYYY-MM-DD" 문자열로 계산한다.
  // pay_date는 DATE 컬럼이므로 문자열 비교(gte/lt)로 범위 조회가 가능하다.
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = nowKst.getUTCFullYear();
  const month = nowKst.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const firstDay = `${year}-${pad(month + 1)}-01`;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextFirstDay = `${nextYear}-${pad(nextMonth + 1)}-01`;
  return { firstDay, nextFirstDay };
}

export default async function AdminDashboardPage() {
  let tenantId: string | null = null;
  try {
    const tenant = await requireTenant();
    tenantId = tenant.id;
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
          테넌트 정보를 확인할 수 없습니다.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { firstDay, nextFirstDay } = getCurrentMonthRange();

  // 카드별로 개별 try/catch를 돌려, 한 쿼리가 실패해도 다른 카드는 렌더링되도록 한다.
  let totalMembersLabel = "—";
  try {
    const { count, error } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .eq("status", "active");
    if (!error && typeof count === "number") {
      totalMembersLabel = `${new Intl.NumberFormat("ko-KR").format(count)}명`;
    }
  } catch {
    // keep em-dash
  }

  let monthAmountLabel = "—";
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("amount")
      .eq("org_id", tenantId)
      .eq("pay_status", "paid")
      .gte("pay_date", firstDay)
      .lt("pay_date", nextFirstDay);
    if (!error && data) {
      const sum = data.reduce(
        (acc: number, row: { amount: number | null }) =>
          acc + Number(row.amount ?? 0),
        0
      );
      monthAmountLabel = formatKRW(sum);
    }
  } catch {
    // keep em-dash
  }

  let activeCampaignsLabel = "—";
  try {
    const { count, error } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .eq("status", "active");
    if (!error && typeof count === "number") {
      activeCampaignsLabel = `${new Intl.NumberFormat("ko-KR").format(count)}건`;
    }
  } catch {
    // keep em-dash
  }

  let unpaidPromiseLabel = "—";
  try {
    // pay_day 기준으로 이미 납입 예정일이 지난 약정만 미납으로 간주한다.
    // nowKst.getUTCDate() = 오늘(KST) 일자 → pay_day ≤ today 인 약정만 포함.
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayDay = nowKst.getUTCDate(); // 1~31

    const { data: activeRegular, error: promiseErr } = await supabase
      .from("promises")
      .select("id, pay_day")
      .eq("org_id", tenantId)
      .eq("status", "active")
      .eq("type", "regular");

    if (!promiseErr) {
      // 납입일(pay_day)이 오늘 이하인 약정만 미납 대상으로 본다
      const dueIds = (activeRegular ?? [])
        .filter(
          (p: { id: string; pay_day: number | null }) =>
            p.pay_day === null || p.pay_day <= todayDay
        )
        .map((p: { id: string }) => p.id);

      if (dueIds.length === 0) {
        unpaidPromiseLabel = "0건";
      } else {
        const { data: paidThisMonth, error: payErr } = await supabase
          .from("payments")
          .select("promise_id")
          .eq("org_id", tenantId)
          .eq("pay_status", "paid")
          .gte("pay_date", firstDay)
          .lt("pay_date", nextFirstDay)
          .in("promise_id", dueIds);
        if (!payErr) {
          const paidIds = new Set(
            (paidThisMonth ?? [])
              .map((p: { promise_id: string | null }) => p.promise_id)
              .filter((id): id is string => Boolean(id))
          );
          const unpaidCount = dueIds.filter(
            (id: string) => !paidIds.has(id)
          ).length;
          unpaidPromiseLabel = `${new Intl.NumberFormat("ko-KR").format(
            unpaidCount
          )}건`;
        }
      }
    }
  } catch {
    // keep em-dash
  }

  // 최근 납입 5건 (paid 상태)
  let recentPayments: RecentPaymentRow[] = [];
  try {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, amount, pay_date, members(id, name), campaigns(id, title)"
      )
      .eq("org_id", tenantId)
      .eq("pay_status", "paid")
      .order("pay_date", { ascending: false, nullsFirst: false })
      .range(0, 4);
    if (!error && data) {
      recentPayments = data as unknown as RecentPaymentRow[];
    }
  } catch {
    // leave empty
  }

  const kpiCards: { title: string; value: string }[] = [
    { title: "총 후원자 수", value: totalMembersLabel },
    { title: "이번 달 납입금액", value: monthAmountLabel },
    { title: "활성 캠페인", value: activeCampaignsLabel },
    { title: "미납 약정", value: unpaidPromiseLabel },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
      <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
        안녕하세요. NPO 후원관리 대시보드입니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kpiCards.map((card) => (
          <Card
            key={card.title}
            className="bg-[var(--surface)] border-[var(--border)]"
          >
            <CardHeader>
              <CardTitle className="text-sm text-[var(--muted-foreground)]">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--text)]">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {recentPayments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">
            최근 납입 5건
          </h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <ul>
              {recentPayments.map((p, idx) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between p-4 ${
                    idx === 0 ? "" : "border-t border-[var(--border)]"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-[var(--text)]">
                      {p.members?.name ?? "익명"}
                      {p.campaigns?.title ? (
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          · {p.campaigns.title}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {formatDateKR(p.pay_date)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {formatKRW(Number(p.amount ?? 0))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
