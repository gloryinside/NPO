import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("campaign-assets storage bucket", () => {
  it("bucket exists and is public", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb.storage.getBucket("campaign-assets");

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe("campaign-assets");
    expect(data?.public).toBe(true);
  });
});
