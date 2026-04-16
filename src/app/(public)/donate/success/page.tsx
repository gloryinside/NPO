import Link from "next/link";
import { redirect } from "next/navigation";
import { confirmDonation } from "@/lib/donations/confirm";

function formatAmount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div
        className="rounded-xl border p-8"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <p
          className="mb-2 text-2xl font-bold"
          style={{ color: "var(--negative)" }}
        >
          결제 확인 실패
        </p>
        <p className="mb-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {message}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg px-6 py-2 text-sm font-semibold"
          style={{
            background: "var(--accent)",
            color: "#ffffff",
          }}
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    paymentKey?: string;
    orderId?: string;
    amount?: string;
  }>;
}) {
  const params = await searchParams;
  const paymentKey = params.paymentKey;
  const orderId = params.orderId;
  const amount = Number(params.amount ?? 0);

  if (!paymentKey || !orderId || !amount) {
    return <ErrorBlock message="잘못된 요청입니다." />;
  }

  let payment;
  try {
    payment = await confirmDonation({ paymentKey, orderId, amount });
  } catch (err) {
    return (
      <ErrorBlock
        message={err instanceof Error ? err.message : "결제 승인 실패"}
      />
    );
  }

  // If the donation came from a wizard campaign, redirect back to the wizard completion step
  if (payment.campaign_slug) {
    redirect(`/donate/wizard?campaign=${payment.campaign_slug}&completed=1`);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div
        className="rounded-xl border p-8"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <p
          className="mb-2 text-3xl font-bold"
          style={{ color: "var(--positive)" }}
        >
          감사합니다!
        </p>
        <p
          className="mb-8 text-base"
          style={{ color: "var(--muted-foreground)" }}
        >
          후원이 완료되었습니다.
        </p>

        <dl
          className="mb-8 flex flex-col gap-3 rounded-lg border p-4 text-left text-sm"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-foreground)" }}>결제번호</dt>
            <dd style={{ color: "var(--text)" }}>{payment.payment_code}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-foreground)" }}>결제금액</dt>
            <dd style={{ color: "var(--text)" }}>
              {formatAmount(Number(payment.amount))}원
            </dd>
          </div>
          {payment.pg_method && (
            <div className="flex justify-between">
              <dt style={{ color: "var(--muted-foreground)" }}>결제수단</dt>
              <dd style={{ color: "var(--text)" }}>{payment.pg_method}</dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg px-6 py-2 text-sm font-semibold"
            style={{
              background: "var(--accent)",
              color: "#ffffff",
            }}
          >
            캠페인으로 돌아가기
          </Link>
          {payment.receipt_url && (
            <a
              href={payment.receipt_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border px-6 py-2 text-sm font-semibold"
              style={{
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              영수증 보기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
