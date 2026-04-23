import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractSlugFromHost } from "@/lib/tenant/resolver";

/**
 * G-D85 / G-D135: 동적 sitemap.
 *
 * 멀티테넌트 분리 — 요청 host 의 slug 로 org 를 식별하고, 해당 org 의
 * campaign 만 포함. slug 가 해석되지 않으면 빈 sitemap 반환.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return [];

  const slug = extractSlugFromHost(host);
  if (!slug) return [];

  const supabase = createSupabaseAdminClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!org) return [];

  const base = `${proto}://${host}`;
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("slug, updated_at, ended_at")
    .eq("org_id", org.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1000);

  for (const c of (campaigns ?? []) as Array<{
    slug: string;
    updated_at: string | null;
    ended_at: string | null;
  }>) {
    entries.push({
      url: `${base}/campaigns/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : now,
      changeFrequency: c.ended_at ? "yearly" : "weekly",
      priority: c.ended_at ? 0.3 : 0.7,
    });
  }
  return entries;
}
