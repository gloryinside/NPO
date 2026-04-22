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

/**
 * rate-limit 키 조립용 IP 정규화. IPv6는 /64 prefix로 마스킹 — 대부분의
 * ISP가 고객당 /64 대역을 할당하므로 같은 대역의 다른 주소로 rate-limit을
 * 우회하는 것을 막는다 (G-113).
 *
 * IPv4는 그대로, IPv4-mapped IPv6는 내부 IPv4만 사용, IPv6는 앞 4 hextets
 * 유지 + "::/64" suffix. 원본 IP는 로깅/감사에 `getClientIp`를 그대로 쓸 것.
 */
export function normalizeIpForKey(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  const raw = ip.trim();
  if (!raw) return "unknown";

  const mappedMatch = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
  if (mappedMatch) return mappedMatch[1]!;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return raw;

  if (raw.includes(":")) {
    const parts = raw.toLowerCase().split("::");
    let head = parts[0] ? parts[0].split(":") : [];
    const tail = parts[1] ? parts[1].split(":") : [];
    if (parts.length === 2) {
      const missing = 8 - head.length - tail.length;
      head = [...head, ...new Array(Math.max(0, missing)).fill("0"), ...tail];
    }
    const prefix = head.slice(0, 4).join(":");
    return `${prefix}::/64`;
  }

  return raw;
}
