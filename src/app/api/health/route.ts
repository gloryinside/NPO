import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D66: 헬스 체크 엔드포인트
 *
 * GET /api/health
 *   - 200 OK: DB 연결 OK, 주요 환경변수 설정
 *   - 503 Service Unavailable: DB 또는 필수 환경변수 문제
 *
 * Uptime monitor, load balancer, Vercel deployment check 용도.
 * 실행 시간 <500ms 목표 — 복잡한 연산 금지.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // 1) 필수 환경변수
  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OTP_JWT_SECRET",
  ];
  for (const key of requiredEnv) {
    checks[`env:${key}`] = {
      ok: Boolean(process.env[key]),
      ...(process.env[key] ? {} : { detail: "missing" }),
    };
  }

  // 2) DB 연결 — 가벼운 쿼리
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("orgs").select("id").limit(1);
    checks.db = error
      ? { ok: false, detail: error.message }
      : { ok: true };
  } catch (err) {
    checks.db = { ok: false, detail: String(err) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      uptimeMs: Date.now() - started,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
