import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolver";

const TENANT_HEADERS = ["x-tenant-id", "x-tenant-slug"] as const;

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenant = await resolveTenant(host);

  // [보안] 테넌트 헤더는 서버(여기)만 정한다. 클라이언트가 보낸 값은 항상 지운다 —
  // 예전엔 테넌트가 없는 호스트(메인 도메인·미등록 서브도메인)에서 요청에 실린
  // x-tenant-id가 그대로 getTenant()까지 전달돼 아무 기관이나 지정할 수 있었다.
  const requestHeaders = new Headers(req.headers);
  for (const h of TENANT_HEADERS) requestHeaders.delete(h);
  if (tenant) {
    requestHeaders.set("x-tenant-id", tenant.id);
    requestHeaders.set("x-tenant-slug", tenant.slug);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (tenant) {
    res.headers.set("x-tenant-id", tenant.id);
    res.headers.set("x-tenant-slug", tenant.slug);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
