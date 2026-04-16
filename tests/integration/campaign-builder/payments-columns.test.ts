import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Exercises migration 20260417000003 — the new builder columns on
// `payments` (designation, custom_fields, idempotency_key) and the
// partial UNIQUE index enforcing at-most-one row per idempotency_key.

const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const IDEMPOTENCY_KEY = `idemp_${uniqueSuffix}`;
const PAYMENT_CODE_A = `pcode_a_${uniqueSuffix}`;
const PAYMENT_CODE_B = `pcode_b_${uniqueSuffix}`;
const MEMBER_CODE = `tm_${uniqueSuffix}`;
const CAMPAIGN_SLUG = `test-payments-columns-${uniqueSuffix}`;

describe("migration 20260417000003 — payments builder columns", () => {
  const sb = createSupabaseAdminClient();
  let orgId: string | undefined;
  let memberId: string | undefined;
  let campaignId: string | undefined;
  let createdMember = false;
  let createdCampaign = false;

  beforeAll(async () => {
    // Reuse any existing org — creating one is out of scope.
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

    // Prefer reusing an existing (member, campaign) pair in this org.
    const { data: existingMember } = await sb
      .from("members")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    const { data: existingCampaign } = await sb
      .from("campaigns")
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
          name: "Payments Columns Fixture",
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

    if (existingCampaign?.id) {
      campaignId = existingCampaign.id;
    } else {
      const { data, error } = await sb
        .from("campaigns")
        .insert({
          org_id: orgId,
          slug: CAMPAIGN_SLUG,
          title: "payments columns fixture",
          donation_type: "onetime",
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !data) {
        expect.fail(
          `failed to create fixture campaign: ${error?.message ?? "unknown"}`
        );
        return;
      }
      campaignId = data.id;
      createdCampaign = true;
    }
  });

  afterAll(async () => {
    await sb.from("payments").delete().eq("idempotency_key", IDEMPOTENCY_KEY);
    if (createdCampaign && campaignId) {
      await sb.from("campaigns").delete().eq("id", campaignId);
    }
    if (createdMember && memberId) {
      await sb.from("members").delete().eq("id", memberId);
    }
  });

  it("enforces UNIQUE on idempotency_key via partial index", async () => {
    expect(orgId && memberId && campaignId).toBeTruthy();

    const basePayment = {
      org_id: orgId!,
      member_id: memberId!,
      campaign_id: campaignId!,
      amount: 10000,
      pay_date: new Date().toISOString().slice(0, 10),
      pay_status: "pending" as const,
      idempotency_key: IDEMPOTENCY_KEY,
      designation: "general",
      custom_fields: { note: "builder test" },
    };

    const { data: first, error: firstErr } = await sb
      .from("payments")
      .insert({ ...basePayment, payment_code: PAYMENT_CODE_A })
      .select("id")
      .single();

    expect(firstErr).toBeNull();
    expect(first?.id).toBeDefined();

    // Second insert with the SAME idempotency_key must fail on the
    // partial UNIQUE index.
    const { data: second, error: secondErr } = await sb
      .from("payments")
      .insert({ ...basePayment, payment_code: PAYMENT_CODE_B })
      .select("id")
      .single();

    expect(second).toBeNull();
    expect(secondErr).not.toBeNull();
    // Postgres unique_violation surfaces through PostgREST as 23505.
    expect(secondErr?.code).toBe("23505");

    // Exactly one row survives.
    const { data: rows, error: listErr } = await sb
      .from("payments")
      .select("id, designation, custom_fields")
      .eq("idempotency_key", IDEMPOTENCY_KEY);
    expect(listErr).toBeNull();
    expect(rows?.length).toBe(1);
    expect(rows?.[0]?.designation).toBe("general");
    expect(
      (rows?.[0]?.custom_fields as { note?: string } | null)?.note
    ).toBe("builder test");
  });
});
