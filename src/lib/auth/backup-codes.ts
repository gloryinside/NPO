import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SP-5 후속: MFA 백업 코드 생성/검증.
 *
 * 포맷: XXXX-XXXX (영숫자 8자 + 하이픈). 10개 발급 → 평문은 1회만 사용자에게 노출.
 * 저장: scrypt(plaintext, salt, N=16384, r=8, p=1, dkLen=64) 의 hex 문자열.
 * 검증: 미사용 코드를 모두 읽어와 평문 입력에 대해 각각 scrypt 비교.
 *       매칭 성공 시 used_at 업데이트로 1회용 보장.
 */

const CODE_GROUPS = 2;
const CHARS_PER_GROUP = 4;
const GROUP_SEPARATOR = "-";
const CODE_COUNT = 10;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const DK_LEN = 64;
const SALT_BYTES = 16;

// 읽기 쉽도록 0/O/1/I 제외
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(): string {
  const totalChars = CODE_GROUPS * CHARS_PER_GROUP;
  const buf = randomBytes(totalChars);
  const chars: string[] = [];
  for (let i = 0; i < totalChars; i++) {
    chars.push(ALPHABET[buf[i] % ALPHABET.length]);
    if ((i + 1) % CHARS_PER_GROUP === 0 && i + 1 < totalChars) {
      chars.push(GROUP_SEPARATOR);
    }
  }
  return chars.join("");
}

function hashCode(
  plaintext: string,
  salt: string,
): string {
  const saltBuf = Buffer.from(salt, "hex");
  const normalized = plaintext.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return scryptSync(normalized, saltBuf, DK_LEN, SCRYPT_OPTIONS).toString(
    "hex",
  );
}

export function generateBackupCodesPlaintext(): string[] {
  const out: string[] = [];
  for (let i = 0; i < CODE_COUNT; i++) out.push(randomCode());
  return out;
}

export function hashBackupCode(plaintext: string): {
  hash: string;
  salt: string;
} {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = hashCode(plaintext, salt);
  return { hash, salt };
}

/** 평문 입력과 DB 레코드(hash+salt)가 일치하는지 타이밍 안전 비교. */
export function verifyBackupCode(
  plaintext: string,
  storedHash: string,
  storedSalt: string,
): boolean {
  const computed = hashCode(plaintext, storedSalt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── DB I/O ──────────────────────────────────────────────

interface BackupCodeRow {
  id: string;
  code_hash: string;
  code_salt: string;
}

/**
 * 미사용 코드 전체를 교체한다. 사용된 코드는 이력 보존을 위해 그대로 둠.
 */
export async function regenerateBackupCodes(
  supabase: SupabaseClient,
  memberId: string,
): Promise<string[]> {
  await supabase
    .from("member_mfa_backup_codes")
    .delete()
    .eq("member_id", memberId)
    .is("used_at", null);

  const plaintexts = generateBackupCodesPlaintext();
  const rows = plaintexts.map((code) => {
    const { hash, salt } = hashBackupCode(code);
    return {
      member_id: memberId,
      code_hash: hash,
      code_salt: salt,
    };
  });

  const { error } = await supabase.from("member_mfa_backup_codes").insert(rows);
  if (error) throw new Error(error.message);
  return plaintexts;
}

/**
 * 미사용 백업 코드 개수 조회.
 */
export async function countUnusedBackupCodes(
  supabase: SupabaseClient,
  memberId: string,
): Promise<number> {
  const { count } = await supabase
    .from("member_mfa_backup_codes")
    .select("*", { count: "exact", head: true })
    .eq("member_id", memberId)
    .is("used_at", null);
  return count ?? 0;
}

/**
 * 평문 코드로 미사용 백업 코드를 소비. 성공 시 true, 실패 시 false.
 * 성공한 코드는 used_at 갱신으로 재사용 차단.
 */
export async function consumeBackupCode(
  supabase: SupabaseClient,
  memberId: string,
  plaintext: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("member_mfa_backup_codes")
    .select("id, code_hash, code_salt")
    .eq("member_id", memberId)
    .is("used_at", null);
  if (error) return false;

  const rows = (data ?? []) as BackupCodeRow[];
  for (const row of rows) {
    if (verifyBackupCode(plaintext, row.code_hash, row.code_salt)) {
      await supabase
        .from("member_mfa_backup_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      return true;
    }
  }
  return false;
}
