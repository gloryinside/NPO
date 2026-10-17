import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// 버킷 메타데이터 조회는 서비스 롤 권한이 필요하다(공개 버킷이어도 anon은 storage.buckets를 못 읽음).
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe("campaign-assets storage bucket", () => {
  it("bucket exists and is public", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb.storage.getBucket("campaign-assets");

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe("campaign-assets");
    expect(data?.public).toBe(true);
  });
});
