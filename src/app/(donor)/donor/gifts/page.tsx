import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "기념품 발송 이력" };

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  preparing: "준비중",
  shipped: "발송 완료",
  skipped: "제외",
};
const STATUS_COLOR: Record<string, string> = {
  queued: "var(--info)",
  preparing: "var(--warning)",
  shipped: "var(--positive)",
  skipped: "var(--muted-foreground)",
};

type Row = {
  id: string;
  gift_name: string;
  trigger_value: number | null;
  status: string;
  shipping_address: string | null;
  tracking_no: string | null;
  shipped_at: string | null;
  created_at: string;
};

export default async function DonorGiftsPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("gift_shipments")
    .select("id, gift_name, trigger_value, status, shipping_address, tracking_no, shipped_at, created_at")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("created_at", { ascending: false });

  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text)]">기념품·감사품</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          기관에서 보내드린 감사품/기념품의 발송 이력을 확인하실 수 있습니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border py-12 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          아직 발송된 기념품이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--text)]">{r.gift_name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    등록일 {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    {r.shipped_at && ` · 발송일 ${new Date(r.shipped_at).toLocaleDateString("ko-KR")}`}
                    {r.tracking_no && ` · 운송장 ${r.tracking_no}`}
                  </p>
                </div>
                <span className="rounded-md px-2 py-1 text-xs font-semibold"
                  style={{ color: STATUS_COLOR[r.status] }}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
