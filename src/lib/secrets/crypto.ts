import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getActiveKeyVersion,
  getPassphraseForVersion,
  parseCiphertext,
  tagCiphertext,
} from "./key-rotation";

/**
 * org_secrets 암호화 유틸리티.
 *
 * 암호문 포맷 (G-D133):
 *   - 신규: `v{n}:{pgp_sym_encrypt_output}` — n 은 키 버전
 *   - 레거시: prefix 없이 pgp_sym_encrypt 결과만. v1 으로 간주하여 복호화.
 *
 * passphrase 선택:
 *   - encrypt: ORG_SECRETS_ACTIVE_VERSION 에 해당하는 키
 *   - decrypt: 암호문 prefix 의 버전에 해당하는 키
 *
 * 폴백: ORG_SECRETS_KEY / RECEIPTS_ENCRYPTION_KEY 는 v1 로 인식.
 */

/** 시크릿을 암호화. 서버 사이드 전용. */
export async function encryptSecret(plaintext: string): Promise<string> {
  const version = getActiveKeyVersion();
  const passphrase = getPassphraseForVersion(version);
  if (!passphrase) {
    throw new Error(
      `ORG_SECRETS_KEY_V${version} (또는 fallback) 이 설정되지 않았습니다.`
    );
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("encrypt_secret", {
    plaintext,
    passphrase,
  });
  if (error) throw new Error(`encrypt_secret failed: ${error.message}`);
  return tagCiphertext(version, data as string);
}

/** 암호화된 시크릿을 복호화. null / 키 누락 시 null 반환. */
export async function decryptSecret(
  ciphertext: string | null | undefined
): Promise<string | null> {
  if (!ciphertext) return null;
  const { version, ciphertext: raw } = parseCiphertext(ciphertext);
  const passphrase = getPassphraseForVersion(version);
  if (!passphrase) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("decrypt_secret", {
    ciphertext: raw,
    passphrase,
  });
  if (error) {
    console.error(
      `[secrets] decrypt_secret failed (v${version}):`,
      error.message
    );
    return null;
  }
  return (data as string | null) ?? null;
}

/** API 키의 SHA-256 hex digest. 타이밍 공격 없는 인증용. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** 8자 미리보기용. 평문 전체는 반환 금지 (UI 마스킹용). */
export function maskPlaintext(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return plaintext.slice(0, 4) + "••••" + plaintext.slice(-4);
}
