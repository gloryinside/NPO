import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * org_secrets 암호화 유틸리티.
 *
 * 모든 Toss/ERP 시크릿은 DB에 pgp_sym_encrypt 로 저장되며,
 * 여기서 service role RPC 로 암복호화한다.
 * passphrase는 ORG_SECRETS_KEY env var (fallback: RECEIPTS_ENCRYPTION_KEY).
 */

function getPassphrase(): string | null {
  return (
    process.env.ORG_SECRETS_KEY ||
    process.env.RECEIPTS_ENCRYPTION_KEY ||
    null
  );
}

/** 시크릿을 암호화. 서버 사이드 전용. */
export async function encryptSecret(plaintext: string): Promise<string> {
  const passphrase = getPassphrase();
  if (!passphrase) {
    throw new Error("ORG_SECRETS_KEY가 설정되지 않았습니다.");
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("encrypt_secret", {
    plaintext,
    passphrase,
  });
  if (error) throw new Error(`encrypt_secret failed: ${error.message}`);
  return data as string;
}

/** 암호화된 시크릿을 복호화. null / 키 누락 시 null 반환. */
export async function decryptSecret(
  ciphertext: string | null | undefined
): Promise<string | null> {
  if (!ciphertext) return null;
  const passphrase = getPassphrase();
  if (!passphrase) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("decrypt_secret", {
    ciphertext,
    passphrase,
  });
  if (error) {
    console.error("[secrets] decrypt_secret failed:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

/** API 키의 SHA-256 hex digest (소문자 64자). 타이밍 공격 없는 인증용. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** 8자 미리보기용. 평문 전체는 반환 금지 (UI 마스킹용). */
export function maskPlaintext(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return plaintext.slice(0, 4) + "••••" + plaintext.slice(-4);
}
