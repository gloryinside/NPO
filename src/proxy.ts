import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolver";

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenant = await resolveTenant(host);

  const res = NextResponse.next();

  if (tenant) {
    res.headers.set("x-tenant-id", tenant.id);
    res.headers.set("x-tenant-slug", tenant.slug);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
