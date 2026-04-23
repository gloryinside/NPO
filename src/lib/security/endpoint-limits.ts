import { NextResponse } from "next/server";
import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";

/**
 * G-D74: donor 쪽 mutation 라우트 공용 rate limit 헬퍼.
 *
 * 사용:
 *   const ok = enforceDonorLimit(session.member.id, 'profile:patch');
 *   if (!ok.allowed) return limitResponse(ok);
 *
 * 프리셋:
 *   - default: 1분 20회 (일반 설정 변경)
 *   - sensitive: 10분 10회 (계정·비밀번호 변경 등)
 *   - low-noise: 1분 60회 (세션 bump, 테마 등 부하 미미)
 *
 * 키 네이밍:
 *   `{preset}:{route}:{memberId}` — Redis 교체 시에도 동일 네임스페이스 유지.
 */
export type DonorLimitPreset = "default" | "sensitive" | "low-noise";

const PRESETS: Record<DonorLimitPreset, { limit: number; windowMs: number }> = {
  default: { limit: 20, windowMs: 60_000 },
  sensitive: { limit: 10, windowMs: 10 * 60_000 },
  "low-noise": { limit: 60, windowMs: 60_000 },
};

export function enforceDonorLimit(
  memberId: string,
  route: string,
  preset: DonorLimitPreset = "default"
): RateLimitResult {
  const cfg = PRESETS[preset];
  return rateLimit(`donor:${preset}:${route}:${memberId}`, cfg.limit, cfg.windowMs);
}

export function limitResponse(result: RateLimitResult): Response {
  return NextResponse.json(
    {
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfterMs: result.retryAfterMs,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
      },
    }
  );
}
