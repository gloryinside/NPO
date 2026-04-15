import Link from "next/link";
import { cancelDonation } from "@/lib/donations/confirm";

export default async function DonateFailPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    message?: string;
    orderId?: string;
  }>;
}) {
  const params = await searchParams;
  const message = params.message ?? "결제가 취소되었습니다.";
  const code = params.code ?? null;
  const orderId = params.orderId ?? null;

  if (orderId) {
    try {
      await cancelDonation(orderId, message);
    } catch {
      // 실패해도 UI 는 보여줌
    }
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
          style={{ color: "var(--negative)" }}
        >
          결제가 취소되었습니다
        </p>
        <p
          className="mb-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {message}
        </p>
        {code && (
          <p
            className="mb-6 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            오류코드: {code}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border px-6 py-2 text-sm font-semibold"
            style={{
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
