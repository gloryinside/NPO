import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CSV_BOM, csvRow } from "@/lib/csv/escape";
import { logAudit } from "@/lib/audit";

/**
 * G-D116: 관리자 멤버 일괄 CSV 내보내기.
 *
 * GET /api/admin/members/export?status=active&joinPath=org_campaign
 *   filter:
 *     - status: 'active' | 'inactive' | 'withdrawn' | 'deceased'
 *     - joinPath: 문자열 정확 일치
 *     - marketingConsent: 'true' | 'false'
 *
 * 최대 10000행. 민감정보(주민번호) 제외.
 */
const STATUS_WHITELIST = new Set([
  "active",
  "inactive",
  "withdrawn",
  "deceased",
]);

const HEADERS = [
  "회원코드",
  "이름",
  "이메일",
  "휴대폰",
  "생년월일",
  "상태",
  "유입경로",
  "마케팅동의",
  "추천인회원ID",
  "가입일",
];

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const joinPath = sp.get("joinPath");
  const consent = sp.get("marketingConsent");

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("members")
    .select(
      "member_code, name, email, phone, birth_date, status, join_path, marketing_consent, referrer_id, created_at"
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .range(0, 9999);

  if (status && STATUS_WHITELIST.has(status)) query = query.eq("status", status);
  if (joinPath) query = query.eq("join_path", joinPath);
  if (consent === "true") query = query.eq("marketing_consent", true);
  else if (consent === "false") query = query.eq("marketing_consent", false);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    member_code: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    birth_date: string | null;
    status: string | null;
    join_path: string | null;
    marketing_consent: boolean | null;
    referrer_id: string | null;
    created_at: string | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  const lines: string[] = [csvRow(HEADERS)];
  for (const r of rows) {
    lines.push(
      csvRow([
        r.member_code ?? "",
        r.name ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.birth_date ?? "",
        r.status ?? "",
        r.join_path ?? "",
        r.marketing_consent ? "Y" : "N",
        r.referrer_id ?? "",
        r.created_at
          ? new Date(r.created_at).toLocaleDateString("ko-KR")
          : "",
      ])
    );
  }
  const body = CSV_BOM + lines.join("\r\n");

  // 감사 로그 (G-D99)
  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.data_export",
    resourceType: "members",
    summary: `멤버 CSV 내보내기 (${rows.length}건)`,
    metadata: { status, joinPath, marketingConsent: consent, count: rows.length },
  }).catch(() => {});

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members_${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
