import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * G-D85 / G-D145: robots.txt
 *
 * - 프로덕션(Vercel, NEXT_PUBLIC_BASE_DOMAIN 일치): donor/admin/api 크롤 거부, 공개 경로 허용
 * - 비프로덕션(localhost, staging, preview 등): 전체 disallow 하여 색인 방지
 */
function isProductionHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const base = (process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "").toLowerCase();
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.includes(".vercel.app")) return false; // preview
  if (!base) return false; // base domain 미설정 시 보수적으로 false
  return hostname === base || hostname.endsWith(`.${base}`);
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : "";

  if (!isProductionHost(host)) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }

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
