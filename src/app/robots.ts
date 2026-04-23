import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * G-D85: robots.txt — donor/admin/api 경로는 크롤 거부, 공개 캠페인만 허용.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : "";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/campaigns/"],
        disallow: ["/donor/", "/admin/", "/api/"],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
