/**
 * G-D73: Upstash Redis REST 기반 rate limit (옵션).
 *
 * 환경변수가 설정돼 있으면 활성화, 없으면 in-memory fallback.
 * REST 기반이라 Vercel Edge/Node 런타임 모두 호환.
 *
 * 환경변수:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * 알고리즘: Redis INCR + EXPIRE (fixed-window). 고정 윈도우라 정확도는 sliding 보다 낮지만
 * 대량 부하에서 빠르고 단순. 공격자 burst는 첫 윈도우에서 차단되므로 충분.
 *
 * 사용:
 *   const res = await rateLimitRedis('otp:verify:ip:127.0.0.1', 20, 600_000)
 *   if (!res.allowed) ...
 */

type Result = { allowed: boolean; remaining: number; retryAfterMs: number };

export function redisEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<Result | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const bucket = Math.floor(Date.now() / windowMs);
  const rkey = `rl:${key}:${bucket}`;

  // Upstash REST pipeline: INCR + EXPIRE
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", rkey],
        ["PEXPIRE", rkey, String(windowMs)],
      ]),
      // 500ms 내 응답 없으면 포기 — 절대 앱을 지연시키지 말 것
      signal: AbortSignal.timeout(500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result: number | string }>;
    const count = Number(data[0]?.result ?? 0);
    const remaining = Math.max(0, limit - count);
    const retryAfterMs = (bucket + 1) * windowMs - Date.now();
    return {
      allowed: count <= limit,
      remaining,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  } catch {
    // 네트워크 실패 → null 반환해 호출부가 in-memory로 폴백
    return null;
  }
}
