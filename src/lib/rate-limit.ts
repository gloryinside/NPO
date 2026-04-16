/**
 * 간단한 in-memory sliding window rate limiter.
 *
 * 제한:
 *   - 서버리스 instance 마다 분리된 메모리 (멀티 instance에서 공격자가 여러 warm instance를
 *     병렬로 때리면 실질 한도는 instance_count * limit). Vercel KV / Upstash Redis 도입 전
 *     최소한의 방어선으로만 사용.
 *   - 메모리 누수 방지: 최근 window 내 만료된 timestamp를 정리.
 *
 * 키는 보통 IP:route 조합. 반환값은 허용 여부 + 재시도까지 남은 ms.
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const entry = store.get(key) ?? { timestamps: [] };
  const windowStart = now - windowMs;
  // 만료된 timestamp 정리
  const fresh = entry.timestamps.filter((t) => t > windowStart);

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    store.set(key, { timestamps: fresh });
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  fresh.push(now);
  store.set(key, { timestamps: fresh });
  return {
    allowed: true,
    remaining: Math.max(0, limit - fresh.length),
    retryAfterMs: 0,
  };
}

/** 요청 헤더에서 best-effort client IP 추출. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
