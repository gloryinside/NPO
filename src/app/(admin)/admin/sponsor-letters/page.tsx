import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { LetterRow } from "./letter-row";

export const metadata = { title: "편지·번역 큐" };

const STATUS_LABEL: Record<string, string> = {
  received: "접수",
  translating: "번역 중",
  reviewed: "검수 완료",
  delivered: "전달 완료",
  rejected: "반려",
};

type Row = {
  id: string;
  sponsorship_id: string;
  direction: string;
  original_text: string | null;
  translated_text: string | null;
  status: string;
  created_at: string;
};

export default async function SponsorLettersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "received";

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("sponsor_letters")
    .select("id, sponsorship_id, direction, original_text, translated_text, status, created_at")
    .eq("org_id", tenant.id)
    .eq("status", filter)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="결연 편지 처리"
        description="결연 편지의 접수→번역→검수→전달 워크플로."
      />

      <div className="flex gap-2 text-sm">
        {(["received", "translating", "reviewed", "delivered", "rejected"] as const).map((s) => (
          <Link key={s} href={`/admin/sponsor-letters?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>{STATUS_LABEL[s]}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          해당 상태의 편지가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => <LetterRow key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}
