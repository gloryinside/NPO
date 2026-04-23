import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * G-D191: 후원 증서(Certificate) SVG 다운로드.
 *
 * 실제 PDF 렌더러(pdfmake 등)를 도입하기 전에 SVG 로 즉시 제공 — 브라우저에서 바로 인쇄·PDF 저장.
 * 데이터: 최근 연도의 누적 paid 금액 + 회원 이름 + 기관명.
 *
 * GET /api/donor/certificate?year=2026
 */
export async function GET(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(`certificate:${session.member.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다." },
      { status: 429 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year")) || new Date().getFullYear();

  const supabase = createSupabaseAdminClient();

  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", session.member.org_id)
    .maybeSingle();
  const orgName = org?.name ?? "후원 기관";

  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .eq("pay_status", "paid")
    .gte("pay_date", first)
    .lte("pay_date", last);
  const total = (payments ?? []).reduce(
    (s, p) => s + Number((p as { amount: number | null }).amount ?? 0),
    0
  );

  const memberName = escape(session.member.name);
  const amountKRW = total.toLocaleString("ko-KR");
  const issuedAt = new Date().toLocaleDateString("ko-KR");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f3ff"/>
      <stop offset="100%" stop-color="#ede9fe"/>
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="850" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="770" fill="none" stroke="url(#border)" stroke-width="6" rx="12"/>
  <rect x="60" y="60" width="1080" height="730" fill="none" stroke="#c4b5fd" stroke-width="1" rx="8"/>

  <text x="600" y="160" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="28" fill="#6d28d9" font-weight="600" letter-spacing="8">CERTIFICATE OF APPRECIATION</text>
  <text x="600" y="210" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="18" fill="#7c3aed" letter-spacing="4">감 사 증</text>

  <text x="600" y="330" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="48" fill="#1f2937" font-weight="700">${memberName} 님</text>

  <text x="600" y="420" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="22" fill="#374151">
    ${year}년 한 해 동안 ${orgName} 에 보내주신
  </text>
  <text x="600" y="460" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="22" fill="#374151">
    따뜻한 마음과 소중한 후원에 깊이 감사드립니다.
  </text>

  <text x="600" y="560" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="20" fill="#6b7280">누적 후원 금액</text>
  <text x="600" y="620" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="56" fill="#7c3aed" font-weight="800">${amountKRW}원</text>

  <text x="600" y="740" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="16" fill="#6b7280">발급일 ${issuedAt}</text>
  <text x="600" y="770" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="14" fill="#7c3aed" font-weight="600">${escape(orgName)}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="certificate_${year}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
