import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createUserClientForOrg,
  type UserClientForOrg,
} from "../helpers/auth";

describe("campaign_assets RLS — org-scoped isolation", () => {
  const admin = createSupabaseAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let orgAId: string;
  let orgBId: string;
  let userA: UserClientForOrg | undefined;
  let userB: UserClientForOrg | undefined;
  const assetIds: string[] = [];

  beforeAll(async () => {
    // Need two distinct orgs. Prefer the two seeded orgs; if only one
    // exists, create a second ad-hoc org for isolation.
    const { data: orgs, error } = await admin
      .from("orgs")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(2);
    expect(error).toBeNull();
    expect(orgs?.length ?? 0).toBeGreaterThanOrEqual(1);
    orgAId = orgs![0]!.id;

    if ((orgs?.length ?? 0) >= 2) {
      orgBId = orgs![1]!.id;
    } else {
      const { data: created, error: cErr } = await admin
        .from("orgs")
        .insert({ slug: `rls-test-${suffix}`, name: `RLS Test ${suffix}` })
        .select("id")
        .single();
      expect(cErr).toBeNull();
      orgBId = created!.id;
    }

    userA = await createUserClientForOrg(orgAId, {
      memberCode: `RLS-A-${suffix}`,
    });
    userB = await createUserClientForOrg(orgBId, {
      memberCode: `RLS-B-${suffix}`,
    });
  }, 30_000);

  afterAll(async () => {
    if (assetIds.length > 0) {
      await admin.from("campaign_assets").delete().in("id", assetIds);
    }
    await userA?.dispose();
    await userB?.dispose();
    // If we created an ad-hoc second org, clean it up. Detect by slug prefix.
    await admin
      .from("orgs")
      .delete()
      .eq("slug", `rls-test-${suffix}`)
      .then(() => {}, () => {});
  }, 30_000);

  it("admin inserts rows in both orgs (service role bypasses RLS)", async () => {
    const { data: aRow, error: aErr } = await admin
      .from("campaign_assets")
      .insert({
        org_id: orgAId,
        storage_path: `a/${suffix}.png`,
        public_url: `https://example.test/a/${suffix}.png`,
        mime_type: "image/png",
        size_bytes: 1024,
      })
      .select("id")
      .single();
    expect(aErr).toBeNull();
    expect(aRow?.id).toBeDefined();
    assetIds.push(aRow!.id);

    const { data: bRow, error: bErr } = await admin
      .from("campaign_assets")
      .insert({
        org_id: orgBId,
        storage_path: `b/${suffix}.png`,
        public_url: `https://example.test/b/${suffix}.png`,
        mime_type: "image/png",
        size_bytes: 2048,
      })
      .select("id")
      .single();
    expect(bErr).toBeNull();
    expect(bRow?.id).toBeDefined();
    assetIds.push(bRow!.id);
  });

  it("user B sees only org B rows (not org A)", async () => {
    const { data, error } = await userB!.client
      .from("campaign_assets")
      .select("id, org_id, storage_path")
      .in("id", assetIds);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    // RLS must filter out orgA's row even though ids are explicitly requested.
    for (const row of data!) {
      expect(row.org_id).toBe(orgBId);
    }
    expect(data!.length).toBe(1);
    expect(data![0]!.storage_path).toBe(`b/${suffix}.png`);
  });

  it("user B cannot insert a row for org A", async () => {
    const { error } = await userB!.client.from("campaign_assets").insert({
      org_id: orgAId,
      storage_path: `forbidden/${suffix}.png`,
      public_url: `https://example.test/forbidden/${suffix}.png`,
      mime_type: "image/png",
      size_bytes: 512,
    });
    expect(error).not.toBeNull();
    // Postgres RLS violation: code 42501 (insufficient_privilege) per PostgREST.
    expect(error?.code).toBe("42501");
  });

  it("user B can insert into their own org", async () => {
    const { data, error } = await userB!.client
      .from("campaign_assets")
      .insert({
        org_id: orgBId,
        storage_path: `b-self/${suffix}.png`,
        public_url: `https://example.test/b-self/${suffix}.png`,
        mime_type: "image/png",
        size_bytes: 256,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    assetIds.push(data!.id);
  });

  it("user B cannot delete org A rows", async () => {
    const orgARowId = assetIds[0]!; // first inserted was org A
    const { error, count } = await userB!.client
      .from("campaign_assets")
      .delete({ count: "exact" })
      .eq("id", orgARowId);
    // DELETE with RLS filter returns success but affects 0 rows.
    expect(error).toBeNull();
    expect(count ?? 0).toBe(0);
    // Verify row still present via admin.
    const { data: still } = await admin
      .from("campaign_assets")
      .select("id")
      .eq("id", orgARowId)
      .maybeSingle();
    expect(still?.id).toBe(orgARowId);
  });
});
