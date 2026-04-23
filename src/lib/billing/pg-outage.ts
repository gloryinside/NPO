/**
 * G-D195: PG(Toss) 장애 감지 간이 계층.
 *
 * 최근 5분 window 에서 Toss API 호출 실패율이 20% 이상이면 "degraded" 로 간주.
 * in-memory sliding window — 인스턴스 범위. 클러스터 전역은 Redis(G-D73)로 이전 예정.
 *
 * 사용:
 *   recordPgCall(ok);
 *   const status = getPgStatus();
 *   if (status.degraded) { /* 대체 수단 권유 *\/ }
 */
type Event = { at: number; ok: boolean };

const WINDOW_MS = 5 * 60_000;
const MIN_SAMPLES = 10;
const DEGRADED_FAIL_RATE = 0.2;

const events: Event[] = [];

export function recordPgCall(ok: boolean): void {
  const now = Date.now();
  events.push({ at: now, ok });
  const cutoff = now - WINDOW_MS;
  while (events.length > 0 && events[0]!.at < cutoff) events.shift();
}

export function getPgStatus(): {
  degraded: boolean;
  failRate: number;
  samples: number;
} {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  // lazy cleanup
  while (events.length > 0 && events[0]!.at < cutoff) events.shift();

  const samples = events.length;
  if (samples < MIN_SAMPLES) {
    return { degraded: false, failRate: 0, samples };
  }
  const fails = events.reduce((n, e) => n + (e.ok ? 0 : 1), 0);
  const failRate = fails / samples;
  return {
    degraded: failRate >= DEGRADED_FAIL_RATE,
    failRate,
    samples,
  };
}
