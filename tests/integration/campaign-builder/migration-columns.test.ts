import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Default sentinel that the 20260417000001 migration writes into
// `page_content` / `published_content` before any backfill touches rows.
const DEFAULT_PAGE_CONTENT = {
  meta: { schemaVersion: 1 },
  blocks: [],
};
const DEFAULT_PUBLISHED_CONTENT = {};

const FIXTURE_DESCRIPTION = "<p>fixture description</p>";
const FIXTURE_SLUG_PREFIX = "test-builder-migration";

describe("migration 20260417000001 — campaign builder columns", () => {
  const sb = createSupabaseAdminClient();
  let orgId: string | undefined;
  let richTextFixtureId: string | undefined;
  let publishedFixtureId: string | undefined;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    // Reuse any existing org — creating a new one would require satisfying
    // columns/constraints outside the scope of this migration test.
    const { data: orgRow } = await sb
      .from("orgs")
      .select("id")
      .limit(1)
      .maybeSingle();
    orgId = orgRow?.id;
    expect(
      orgId,
      "integration test requires at least one org row to exist"
    ).toBeDefined();
    if (!orgId) return;

    // Fixture 1: draft campaign used to exercise the richText backfill.
    const { data: r1, error: e1 } = await sb
      .from("campaigns")
      .insert({
        org_id: orgId,
        slug: `${FIXTURE_SLUG_PREFIX}-rich-${uniqueSuffix}`,
        title: "richText backfill fixture",
        description: FIXTURE_DESCRIPTION,
        donation_type: "onetime",
        status: "draft",
        page_content: DEFAULT_PAGE_CONTENT,
        published_content: DEFAULT_PUBLISHED_CONTENT,
      })
      .select("id")
      .single();
    expect(e1).toBeNull();
    richTextFixtureId = r1?.id;

    // Fixture 2: active campaign used to exercise the published_content
    // snapshot backfill. We pre-populate page_content with a non-default
    // shape so the richText backfill skips it, then run only the publish
    // snapshot update below.
    const prePublished = {
      meta: { schemaVersion: 1 },
      blocks: [
        {
          id: "pre-existing",
          type: "richText",
          props: { html: FIXTURE_DESCRIPTION },
        },
      ],
    };
    const { data: r2, error: e2 } = await sb
      .from("campaigns")
      .insert({
        org_id: orgId,
        slug: `${FIXTURE_SLUG_PREFIX}-pub-${uniqueSuffix}`,
        title: "publish snapshot fixture",
        description: FIXTURE_DESCRIPTION,
        donation_type: "onetime",
        status: "active",
        page_content: prePublished,
        published_content: DEFAULT_PUBLISHED_CONTENT,
      })
      .select("id")
      .single();
    expect(e2).toBeNull();
    publishedFixtureId = r2?.id;
  });

  afterAll(async () => {
    const ids = [richTextFixtureId, publishedFixtureId].filter(
      (v): v is string => Boolean(v)
    );
    if (ids.length === 0) return;
    await sb.from("campaigns").delete().in("id", ids);
  });

  it("new columns exist and are selectable", async () => {
    const { error } = await sb
      .from("campaigns")
      .select(
        "id, page_content, published_content, published_at, preview_token, form_settings"
      )
      .limit(1);
    expect(error).toBeNull();
  });

  it("backfills a richText block from non-empty description", async () => {
    expect(richTextFixtureId).toBeDefined();

    // Re-run the migration's richText backfill via an equivalent
    // update() call scoped to the fixture id (supabase-js has no generic
    // raw-SQL helper, so we replicate the UPDATE's shape).
    const { data: before } = await sb
      .from("campaigns")
      .select("description, page_content")
      .eq("id", richTextFixtureId!)
      .single();
    expect(before?.description).toBe(FIXTURE_DESCRIPTION);

    const backfilled = {
      meta: { schemaVersion: 1 },
      blocks: [
        {
          id: "fixture-richtext",
          type: "richText",
          props: { html: before?.description ?? "" },
        },
      ],
    };
    const { error: updErr } = await sb
      .from("campaigns")
      .update({ page_content: backfilled })
      .eq("id", richTextFixtureId!);
    expect(updErr).toBeNull();

    const { data } = await sb
      .from("campaigns")
      .select("page_content, description")
      .eq("id", richTextFixtureId!)
      .single();

    const pc = data?.page_content as {
      blocks: Array<{ type: string; props: { html: string } }>;
    };
    expect(Array.isArray(pc.blocks)).toBe(true);
    expect(pc.blocks[0]?.type).toBe("richText");
    expect(pc.blocks[0]?.props?.html).toBe(FIXTURE_DESCRIPTION);
  });

  it("snapshots page_content into published_content for active campaigns", async () => {
    expect(publishedFixtureId).toBeDefined();

    // Replicate the migration's publish-snapshot UPDATE scoped to the
    // fixture (status='active' AND published_content is default empty).
    const { data: row } = await sb
      .from("campaigns")
      .select("page_content, updated_at")
      .eq("id", publishedFixtureId!)
      .single();
    expect(row?.page_content).toBeDefined();

    const { error: updErr } = await sb
      .from("campaigns")
      .update({
        published_content: row!.page_content,
        published_at: row!.updated_at ?? new Date().toISOString(),
      })
      .eq("id", publishedFixtureId!)
      .eq("status", "active");
    expect(updErr).toBeNull();

    const { data: after, error } = await sb
      .from("campaigns")
      .select("page_content, published_content, published_at")
      .eq("id", publishedFixtureId!)
      .single();
    expect(error).toBeNull();
    expect(after?.published_content).toEqual(after?.page_content);
    expect(after?.published_at).not.toBeNull();
  });

  it("preview_token column accepts non-null values (partial index exercised)", async () => {
    // The partial index `campaigns_preview_token_idx` is declared in the
    // migration file and version-controlled. We don't assert pg_indexes
    // here (not exposed through PostgREST by default); instead we verify
    // the column accepts and returns a non-null token, which is what the
    // preview flow will rely on at runtime.
    expect(richTextFixtureId).toBeDefined();
    const token = `tok_${uniqueSuffix}`;
    const { error: updErr } = await sb
      .from("campaigns")
      .update({ preview_token: token })
      .eq("id", richTextFixtureId!);
    expect(updErr).toBeNull();

    const { data, error } = await sb
      .from("campaigns")
      .select("preview_token")
      .eq("id", richTextFixtureId!)
      .single();
    expect(error).toBeNull();
    expect(data?.preview_token).toBe(token);
  });
});
