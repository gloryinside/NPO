/**
 * G-D72: IPv4 CIDR 매칭 유틸.
 * 단일 IP 는 /32 로 취급. 지원하지 않는 입력은 false 반환.
 */
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipToInt(ip: string): number | null {
  const m = ip.match(IPV4_RE);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  );
}

export function matchCidr(ip: string, cidr: string): boolean {
  const [base, maskStr] = cidr.split("/");
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base ?? "");
  if (ipInt == null || baseInt == null) return false;
  const mask = maskStr ? Number(maskStr) : 32;
  if (!(mask >= 0 && mask <= 32)) return false;
  if (mask === 0) return true;
  const shift = 32 - mask;
  return ipInt >>> shift === baseInt >>> shift;
}

/**
 * 콤마 구분 CIDR 목록에 IP가 매칭되는지.
 * 목록이 비어 있으면 true (모든 IP 허용 — 화이트리스트 미활성).
 */
export function isIpInAllowList(ip: string, csv: string | undefined): boolean {
  const raw = (csv ?? "").trim();
  if (!raw) return true;
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const it of items) {
    if (matchCidr(ip, it)) return true;
  }
  return false;
}
