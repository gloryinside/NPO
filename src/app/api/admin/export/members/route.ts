import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvHeaders } from "@/lib/csv";

type MemberRow = {
  member_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  member_type: string;
  status: string;
  join_path: string | null;
  note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  deceased: "사망",
};

const TYPE_LABEL: Record<string, string> = {
  individual: "개인",
  corporate: "법인",
};

/**
 * GET /api/admin/export/members?q=&status=&payMethod=&promiseType=
 * 현재 필터 기준으로 후원자 목록 CSV 다운로드.
 */
export async function GET(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return new Response("Tenant not found", { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "active";
  const payMethod = searchParams.get("payMethod") ?? "";
  const promiseType = searchParams.get("promiseType") ?? "";

  const supabase = createSupabaseAdminClient();

  // payMethod / promiseType 필터는 promises 테이블 → member_id 서브쿼리
  let filteredMemberIds: string[] | null = null;
  if (payMethod || promiseType) {
    let pq = supabase
      .from("promises")
      .select("member_id")
      .eq("org_id", tenant.id);
    if (payMethod) pq = pq.eq("pay_method", payMethod);
    if (promiseType) pq = pq.eq("type", promiseType);
    const { data: pRows } = await pq;
    filteredMemberIds = [
      ...new Set((pRows ?? []).map((r: { member_id: string }) => r.member_id)),
    ];
    if (filteredMemberIds.length === 0) {
      const csv = toCsv(
        ["회원코드", "이름", "연락처", "이메일", "생년월일", "회원유형", "상태", "가입경로", "메모", "등록일"],
        []
      );
      return new Response(csv, { headers: csvHeaders(`members-${new Date().toISOString().slice(0, 10)}.csv`) });
    }
  }

  let query = supabase
    .from("members")
    .select("member_code, name, phone, email, birth_date, member_type, status, join_path, note, created_at")
    .eq("org_id", tenant.id);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    const escaped = q.replace(/[%,()]/g, "");
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  if (filteredMemberIds) query = query.in("id", filteredMemberIds);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(10000);

  if (error) return new Response(error.message, { status: 500 });

  const rows: MemberRow[] = (data ?? []) as MemberRow[];
  const csvRows = rows.map((m) => [
    m.member_code,
    m.name,
    m.phone ?? "",
    m.email ?? "",
    m.birth_date ?? "",
    TYPE_LABEL[m.member_type] ?? m.member_type,
    STATUS_LABEL[m.status] ?? m.status,
    m.join_path ?? "",
    m.note ?? "",
    m.created_at ? new Date(m.created_at).toLocaleDateString("ko-KR") : "",
  ]);

  const csv = toCsv(
    ["회원코드", "이름", "연락처", "이메일", "생년월일", "회원유형", "상태", "가입경로", "메모", "등록일"],
    csvRows
  );

  const filename = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: csvHeaders(filename) });
}
