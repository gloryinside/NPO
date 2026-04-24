import { requireDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/donor";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonorPaymentsFilter } from "@/components/donor/donor-payments-filter";
import { PaymentCancelButton } from "@/components/donor/payment-cancel-button";
import { PaymentRetryButton } from "@/components/donor/payment-retry-button";
import { PaymentsExportBar } from "@/components/donor/payments-export-bar";
import { getPgErrorMessage } from "@/lib/payments/pg-error-messages";
import type { PayStatus, PaymentWithRelations } from "@/types/payment";
import { Suspense } from "react";

function PayStatusBadge({ status, label }: { status: PayStatus; label: string }) {
  const styles: Record<PayStatus, React.CSSProperties> = {
    paid: { background: "var(--positive-soft)", color: "var(--positive)" },
    pending: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    unpaid: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    failed: { background: "var(--negative-soft)", color: "var(--negative)" },
    cancelled: {
      background: "var(--negative-soft)",
      color: "var(--negative)",
    },
    refunded: { background: "var(--warning-soft)", color: "var(--warning)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {label}
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

type SearchParams = Promise<{
  year?: string;
  month?: string;
  status?: string;
  page?: string;
}>;

const PAGE_SIZE = 20;

export default async function DonorPaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { member } = await requireDonorSession();
  const t = await getT();
  const supabase = createSupabaseAdminClient();

  const { year, month, status, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  // Fetch all payments first to derive year list, then filter
  // For performance on large data, we fetch filtered directly via date range
  let query = supabase
    .from("payments")
    .select("*, campaigns(id, title)", { count: "exact" })
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("pay_date", { ascending: false, nullsFirst: false });

  if (year) {
    const y = Number(year);
    if (month) {
      const m = Number(month);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("pay_date", start).lte("pay_date", end);
    } else {
      query = query
        .gte("pay_date", `${y}-01-01`)
        .lte("pay_date", `${y}-12-31`);
    }
  }

  if (status) {
    query = query.eq("pay_status", status);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);
  const payments = (data as unknown as PaymentWithRelations[]) ?? [];
  const total = count ?? payments.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Filtered sum of paid amount (separate query to count all rows, not just current page)
  let paidSumQuery = supabase
    .from("payments")
    .select("amount")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("pay_status", "paid");
  if (year) {
    const y = Number(year);
    if (month) {
      const m = Number(month);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      paidSumQuery = paidSumQuery.gte("pay_date", start).lte("pay_date", end);
    } else {
      paidSumQuery = paidSumQuery
        .gte("pay_date", `${y}-01-01`)
        .lte("pay_date", `${y}-12-31`);
    }
  }
  const { data: paidRows } = await paidSumQuery;
  const totalPaid = (paidRows ?? []).reduce(
    (sum: number, r: { amount: number | null }) => sum + Number(r.amount ?? 0),
    0
  );

  // Derive available years from unfiltered data for the year selector
  const { data: yearRows } = await supabase
    .from("payments")
    .select("pay_date")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .not("pay_date", "is", null);

  const years = [
    ...new Set(
      (yearRows ?? [])
        .map((r: { pay_date: string | null }) =>
          r.pay_date ? new Date(r.pay_date).getFullYear() : null
        )
        .filter((y): y is number => y !== null)
    ),
  ].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {t("donor.payments.title")}
        </h1>
        <div
          className="text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {total.toLocaleString("ko-KR")} · {formatAmount(totalPaid)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Suspense>
          <DonorPaymentsFilter
            years={years}
            selectedYear={year ?? ""}
            selectedMonth={month ?? ""}
            selectedStatus={status ?? ""}
          />
        </Suspense>
        {total > 0 && (
          <PaymentsExportBar
            year={year ?? ""}
            month={month ?? ""}
            status={status ?? ""}
          />
        )}
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Table>
          <caption className="sr-only">{t("donor.payments.title")}</caption>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--border)" }}>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.date")}</TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.campaign")}</TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.amount")}</TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.status")}</TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.receipt")}</TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>{t("donor.payments.column.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t("donor.payments.empty")}
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  style={{ borderColor: "var(--border)" }}
                >
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(p.pay_date)}
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    <div>{p.campaigns?.title ?? t("common.general_donation")}</div>
                    {p.pay_status === "failed" && p.fail_reason && (() => {
                      const { message, action } = getPgErrorMessage(p.fail_reason);
                      return (
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--negative)" }}
                        >
                          {message} {action}
                        </p>
                      );
                    })()}
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {formatAmount(p.amount)}
                  </TableCell>
                  <TableCell>
                    <PayStatusBadge status={p.pay_status} label={t(`donor.payments.status.${p.pay_status}`)} />
                  </TableCell>
                  <TableCell>
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {t("donor.payments.receipt.view")}
                      </a>
                    ) : (
                      <span
                        className="text-sm"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.pay_status === 'paid' && p.pay_date && (() => {
                        const daysSince = (Date.now() - new Date(p.pay_date as string).getTime()) / 86400000;
                        return daysSince <= 7 ? <PaymentCancelButton paymentId={p.id} /> : null;
                      })()}
                      {(p.pay_status === 'failed' || p.pay_status === 'unpaid') && (
                        <PaymentRetryButton paymentId={p.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <PaymentsPagination
          page={page}
          totalPages={totalPages}
          year={year}
          month={month}
          status={status}
        />
      )}
    </div>
  );
}

function PaymentsPagination({
  page,
  totalPages,
  year,
  month,
  status,
}: {
  page: number;
  totalPages: number;
  year?: string;
  month?: string;
  status?: string;
}) {
  function href(p: number): string {
    const sp = new URLSearchParams();
    if (year) sp.set("year", year);
    if (month) sp.set("month", month);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const q = sp.toString();
    return q ? `?${q}` : "/donor/payments";
  }

  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav
      aria-label="페이지 이동"
      className="flex items-center justify-center gap-2 pt-4 text-sm"
    >
      {prev ? (
        <a
          href={href(prev)}
          className="rounded-md border px-3 py-1.5"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          이전
        </a>
      ) : (
        <span
          className="rounded-md border px-3 py-1.5 opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          이전
        </span>
      )}
      <span style={{ color: "var(--muted-foreground)" }}>
        {page} / {totalPages}
      </span>
      {next ? (
        <a
          href={href(next)}
          className="rounded-md border px-3 py-1.5"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          다음
        </a>
      ) : (
        <span
          className="rounded-md border px-3 py-1.5 opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          다음
        </span>
      )}
    </nav>
  );
}
