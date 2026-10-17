/**
 * G-D133: PII 암호화 키 버전닝 + 회전 보조 유틸.
 *
 * 전략:
 *   1. ORG_SECRETS_KEY_V{n} env 로 키를 버전 별로 선언
 *      예: ORG_SECRETS_KEY_V1, ORG_SECRETS_KEY_V2
 *   2. ORG_SECRETS_ACTIVE_VERSION — 현재 활성 키 버전(신규 암호화에 사용)
 *   3. 암호문 포맷: `v{n}:{pgp_ciphertext}` — 복호화 시 prefix 파싱해 올바른 키 선택
 *   4. prefix 없는 기존 암호문은 legacy(ORG_SECRETS_KEY 또는 v1) 로 간주
 *
 * 회전 절차:
 *   - V2 키를 환경변수에 추가
 *   - ACTIVE_VERSION=2 로 전환 → 새 데이터는 v2 로 암호화됨
 *   - 기존 암호문 재암호화는 아직 자동화돼 있지 않다 — 복호화는 prefix로 옛 키를 골라 계속 되므로
 *     V1 키를 폐기하기 전에만 재암호화 스크립트가 필요하다
 *   - V1 키 폐기 후 최종적으로 코드에서도 제거
 */

const LEGACY_ENVS = ["ORG_SECRETS_KEY", "RECEIPTS_ENCRYPTION_KEY"];

export function getActiveKeyVersion(): number {
  const raw = process.env.ORG_SECRETS_ACTIVE_VERSION;
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function getKeyByVersion(version: number): string | null {
  const envKey = `ORG_SECRETS_KEY_V${version}`;
  const v = process.env[envKey];
  if (v) return v;
  // v1 은 legacy key 로 폴백
  if (version === 1) {
    for (const k of LEGACY_ENVS) {
      const lv = process.env[k];
      if (lv) return lv;
    }
  }
  return null;
}

export function getPassphraseForVersion(version: number): string | null {
  return getKeyByVersion(version);
}

/** 저장용 암호문에 버전 prefix 부착. */
export function tagCiphertext(version: number, ciphertext: string): string {
  return `v${version}:${ciphertext}`;
}

/** 저장된 암호문 파싱. prefix 없으면 v1 legacy 로 간주. */
export function parseCiphertext(raw: string): {
  version: number;
  ciphertext: string;
} {
  const m = raw.match(/^v(\d+):([\s\S]+)$/);
  if (m) {
    return { version: Number(m[1]!), ciphertext: m[2]! };
  }
  return { version: 1, ciphertext: raw };
}
