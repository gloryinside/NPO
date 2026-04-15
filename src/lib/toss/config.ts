/**
 * Toss Payments 설정 상수 및 헬퍼.
 *
 * 멀티테넌트 구조에서 키는 환경변수가 아닌 `org_secrets` 테이블에서
 * 요청마다 로드한다. 이 파일은 이제 공용 상수(API base) 와 순수 헬퍼만 노출한다.
 */
export const TOSS_API_BASE = "https://api.tosspayments.com";

/**
 * Toss REST API Basic Auth 헤더 — "Basic base64({secret_key}:)" 포맷.
 * 서버 사이드에서만 호출한다. secretKey 는 호출자가 org_secrets 에서 로드해 주입한다.
 */
export function buildTossAuthHeader(secretKey: string): string {
  const token = Buffer.from(`${secretKey}:`).toString("base64");
  return `Basic ${token}`;
}
