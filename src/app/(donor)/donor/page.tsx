import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentWithRelations } from "@/types/payment";
import type { PromiseWithRelations } from "@/types/promise";

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

export default async function DonorHomePage() {
  const { member } = await requireDonorSession();
  const supabase = createSupabaseAdminClient();

  // 활성 약정
  const { data: activePromisesData } = await supabase
    .from("promises")
    .select("*, campaigns(id, title)")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const activePromises =
    (activePromisesData as unknown as PromiseWithRelations[]) ?? [];

  // 최근 납입 (최대 5건)
  const { data: recentPaymentsData } = await supabase
    .from("payments")
    .select("*, campaigns(id, title)")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("pay_date", { ascending: false, nullsFirst: false })
    .range(0, 4);

  const recentPayments =
    (recentPaymentsData as unknown as PaymentWithRelations[]) ?? [];

  // 누적 후원액 (paid 상태만)
  const { data: paidSumData } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("pay_status", "paid");

  const totalAmount = (paidSumData ?? []).reduce(
    (sum: number, row: { amount: number | null }) =>
      sum + Number(row.amount ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text)" }}
        >
          {member.name}님, 안녕하세요!
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          지금까지의 후원 내역을 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <div
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            누적 후원액
          </div>
          <div
            className="mt-2 text-2xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            {formatAmount(totalAmount)}
          </div>
        </div>
        <div
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <div
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            활성 약정 수
          </div>
          <div
            className="mt-2 text-2xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            {activePromises.length}건
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="/donor/promises"
          className="rounded-lg border px-4 py-3 text-sm hover:opacity-90"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          내 약정 보기 →
        </a>
        <a
          href="/donor/payments"
          className="rounded-lg border px-4 py-3 text-sm hover:opacity-90"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          납입 내역 보기 →
        </a>
      </div>

      <section>
        <h2
          className="mb-3 text-lg font-semibold"
          style={{ color: "var(--text)" }}
        >
          최근 납입 내역
        </h2>
        <div
          className="rounded-lg border"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {recentPayments.length === 0 ? (
            <div
              className="p-6 text-center text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              납입 내역이 없습니다.
            </div>
          ) : (
            <ul>
              {recentPayments.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between p-4"
                  style={{
                    borderTop:
                      idx === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {p.campaigns?.title ?? "일반 후원"}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatDate(p.pay_date)}
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {formatAmount(p.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
