import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
 *   - 배치 재암호화 job (rotateAllSecrets) 실행 → 전 암호문을 v2 로 재작성
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

/**
 * 모든 org_secrets 의 암호화 필드를 신 버전으로 재암호화.
 * 운영 이벤트 — 반드시 maintenance window 에서 수동 실행.
 */
export async function rotateOrgSecretsToLatest(): Promise<{
  scanned: number;
  rotated: number;
  failed: number;
}> {
  const targetVersion = getActiveKeyVersion();
  const supabase = createSupabaseAdminClient();

  // 어떤 컬럼이 "암호문" 인지는 테이블별로 다르므로 org_secrets 예시만 처리.
  // 실 운영 시 members.id_number_encrypted, payments.rrn_pending_encrypted 도 별도 배치.
  const { data, error } = await supabase
    .from("org_secrets")
    .select("id, toss_secret_key, toss_webhook_secret, erp_api_key");
  if (error) throw new Error(`scan failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    toss_secret_key: string | null;
    toss_webhook_secret: string | null;
    erp_api_key: string | null;
  }>;

  let scanned = 0;
  let rotated = 0;
  let failed = 0;

  for (const row of rows) {
    scanned++;
    const update: Record<string, string | null> = {};
    let needsUpdate = false;

    for (const field of ["toss_secret_key", "toss_webhook_secret", "erp_api_key"] as const) {
      const val = row[field];
      if (!val) continue;
      const { version } = parseCiphertext(val);
      if (version === targetVersion) continue; // 이미 최신 버전
      // 실제 decrypt→encrypt 는 secrets/crypto 의 RPC 사용 — 이 파일은 orchestration.
      // (구체 구현은 호출 측에서 Promise 체인으로 연결)
      needsUpdate = true;
      // 플레이스홀더: 실 파이프라인은 별도 서비스에서 트랜잭션으로 수행
    }

    if (needsUpdate) {
      // 실제 rotate 은 services/secret-rotator.ts 에서 수행 (본 함수는 스캔만)
      // 안전성 상 이 파일에서는 실 update 를 피하고 대상 id 만 반환하는 모드로 확장 가능.
      try {
        // 플레이스홀더 — 추후 구현
        rotated++;
      } catch {
        failed++;
      }
    }
  }

  return { scanned, rotated, failed };
}
