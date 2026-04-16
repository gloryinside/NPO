import { describe, it, expect } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

describe("migration 20260417000001 — campaign builder columns", () => {
  it("new columns exist and are selectable", async () => {
    const sb = createSupabaseAdminClient();
    const { error } = await sb
      .from("campaigns")
      .select(
        "id, page_content, published_content, published_at, preview_token, form_settings"
      )
      .limit(1);
    expect(error).toBeNull();
  });

  it("backfills a richText block from non-empty description", async () => {
    const sb = createSupabaseAdminClient();
    const { data, error } = await sb
      .from("campaigns")
      .select("page_content, description")
      .not("description", "is", null)
      .neq("description", "")
      .limit(1)
      .maybeSingle();
    expect(error).toBeNull();
    // If no campaign with a non-empty description exists, the backfill
    // has nothing to assert against — keep the test idempotent.
    if (!data) return;

    const pc = data.page_content as {
      blocks: Array<{ type: string; props: { html: string } }>;
    };
    expect(Array.isArray(pc.blocks)).toBe(true);
    expect(pc.blocks[0]?.type).toBe("richText");
    expect(pc.blocks[0]?.props?.html).toBe(data.description);
  });
});
