import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";
import { VerifyResult } from "@/components/receipt/verify-result";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "영수증 진위 확인",
  robots: { index: false, follow: false },
};

function maskName(name: string | null | undefined): string {
  if (!name || name.length < 2) return "○○";
  if (name.length === 2) return name[0] + "○";
  return name[0] + "○".repeat(name.length - 1);
}

type RouteParams = { code: string };

export default async function ReceiptVerifyPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  // [code] = 영수증 PDF의 QR에 찍힌 무작위 확인 토큰(verify_token).
  // 예전엔 순차 영수증 번호로 조회해 번호를 바꿔 가며 금액·이름을 열람할 수 있었고,
  // 기관 간 번호가 겹치면 조회가 깨졌다. 이 기관(서브도메인)의 영수증만 확인한다.
  const { code } = await params;
  const supabase = createSupabaseAdminClient();
  const tenant = await getTenant();

  const data =
    tenant && /^[A-Za-z0-9_-]{20,64}$/.test(code)
      ? (
          await supabase
            .from("receipts")
            .select("receipt_code, year, total_amount, issued_at, status, members(name)")
            .eq("org_id", tenant.id)
            .eq("verify_token", code)
            .maybeSingle()
        ).data
      : null;

  const row = data as
    | {
        receipt_code: string;
        year: number;
        total_amount: number;
        issued_at: string | null;
        status: string;
        members: { name: string } | null;
      }
    | null;

  const verifyData = row
    ? {
        receipt_code: row.receipt_code,
        year: row.year,
        total_amount: row.total_amount,
        issued_at: row.issued_at,
        status: row.status,
        member_name_masked: maskName(row.members?.name),
      }
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full" style={{ maxWidth: 480 }}>
        <h1
          className="text-xl font-bold text-center mb-6"
          style={{ color: "var(--text)" }}
        >
          기부금 영수증 진위 확인
        </h1>
        <VerifyResult data={verifyData} code={code} />
        <p
          className="mt-4 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          본 페이지는 영수증 진위 확인 전용입니다. 후원자 개인정보는 마스킹되어 표시됩니다.
        </p>
      </div>
    </div>
  );
}
