import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Exercises migration 20260417000004 — pgcrypto + encrypted RRN/biz
// columns on `receipts` plus the 5-year retention timestamp column.
//
// We verify two things:
//   1. The new columns are selectable (schema visibility).
//   2. A row can be inserted with encrypted RRN/biz values and a
//      retention timestamp, then read back with the same values —
//      proving BYTEA round-trips through PostgREST. The pgcrypto
//      extension itself is verified by the migration applying
//      successfully (CREATE EXTENSION IF NOT EXISTS pgcrypto) and by
//      the companion SQL check executed at migration time; supabase-js
//      has no raw-SQL helper for inlining pgp_sym_encrypt() inside an
//      insert payload, so we store a deterministic BYTEA payload from
//      the client here rather than calling the SQL function.

const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MEMBER_CODE = `tm_rrn_${uniqueSuffix}`;
const RECEIPT_CODE = `rcpt_rrn_${uniqueSuffix}`;
const RETENTION_YEARS = 5;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

describe("migration 20260417000004 — receipts RRN encryption", () => {
  const sb = createSupabaseAdminClient();
  let orgId: string | undefined;
  let memberId: string | undefined;
  let receiptId: string | undefined;
  let createdMember = false;

  beforeAll(async () => {
    const { data: orgRow } = await sb
      .from("orgs")
      .select("id")
      .limit(1)
      .maybeSingle();
    orgId = orgRow?.id;
    if (!orgId) {
      expect.fail("integration test requires at least one org row to exist");
      return;
    }

    const { data: existingMember } = await sb
      .from("members")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    if (existingMember?.id) {
      memberId = existingMember.id;
    } else {
      const { data, error } = await sb
        .from("members")
        .insert({
          org_id: orgId,
          member_code: MEMBER_CODE,
          name: "Receipts RRN Fixture",
        })
        .select("id")
        .single();
      if (error || !data) {
        expect.fail(
          `failed to create fixture member: ${error?.message ?? "unknown"}`
        );
        return;
      }
      memberId = data.id;
      createdMember = true;
    }
  });

  afterAll(async () => {
    if (receiptId) {
      await sb.from("receipts").delete().eq("id", receiptId);
    }
    if (createdMember && memberId) {
      await sb.from("members").delete().eq("id", memberId);
    }
  });

  it("new encryption columns are selectable", async () => {
    const { error } = await sb
      .from("receipts")
      .select(
        "id, resident_no_encrypted, business_no_encrypted, rrn_retention_expires_at"
      )
      .limit(1);
    expect(error).toBeNull();
  });

  it("round-trips encrypted BYTEA values and retention timestamp", async () => {
    expect(orgId && memberId).toBeTruthy();

    // Deterministic ciphertext-shaped payload. The real flow encrypts with
    // pgp_sym_encrypt() using a per-org key from org_secrets; here we only
    // assert the column accepts & returns opaque bytes unchanged.
    const residentBytes = new Uint8Array([
      0x9a, 0x01, 0x01, 0x12, 0x34, 0x56, 0x78,
    ]);
    const businessBytes = new Uint8Array([
      0xbb, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    ]);
    const retentionExpiresAt = new Date(
      Date.now() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    // PostgREST accepts BYTEA as base64-decoded `\x`-hex OR as a
    // `\x...` literal string. The supabase-js driver prefers the hex
    // literal form for binary columns.
    const toHex = (b: Uint8Array) =>
      "\\x" +
      Array.from(b)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");

    const { data: inserted, error: insertErr } = await sb
      .from("receipts")
      .insert({
        org_id: orgId!,
        member_id: memberId!,
        receipt_code: RECEIPT_CODE,
        year: new Date().getFullYear(),
        total_amount: 0,
        resident_no_encrypted: toHex(residentBytes),
        business_no_encrypted: toHex(businessBytes),
        rrn_retention_expires_at: retentionExpiresAt,
      })
      .select(
        "id, resident_no_encrypted, business_no_encrypted, rrn_retention_expires_at"
      )
      .single();

    expect(insertErr).toBeNull();
    expect(inserted?.id).toBeDefined();
    receiptId = inserted?.id;

    // PostgREST returns BYTEA as a hex-prefixed string on read.
    expect(typeof inserted?.resident_no_encrypted).toBe("string");
    expect(inserted?.resident_no_encrypted as unknown as string).toContain(
      toBase64(residentBytes).length > 0 ? "" : "" // sanity: string is present
    );
    // The returned representation is `\x9a0101...`; assert the hex body.
    const residentOut = (
      inserted?.resident_no_encrypted as unknown as string
    ).replace(/^\\x/, "");
    const businessOut = (
      inserted?.business_no_encrypted as unknown as string
    ).replace(/^\\x/, "");
    expect(residentOut.toLowerCase()).toBe(
      Array.from(residentBytes)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
    expect(businessOut.toLowerCase()).toBe(
      Array.from(businessBytes)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );

    // Retention timestamp round-trips.
    expect(
      new Date(inserted!.rrn_retention_expires_at as string).toISOString()
    ).toBe(new Date(retentionExpiresAt).toISOString());
  });
});
