import { NextRequest, NextResponse } from 'next/server';

/**
 * SP-3: Deprecated. 신규 클라이언트는 PATCH /api/donor/promises/[id] { action: "cancel" } 사용.
 *
 * 외부 통합이나 구버전 클라이언트 호환을 위해 307 Temporary Redirect 로 통일.
 * 307은 메서드와 본문을 보존하므로 PATCH 가 유지된다.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const target = new URL(
    `/api/donor/promises/${encodeURIComponent(id)}`,
    _req.url,
  );
  return NextResponse.redirect(target, 307);
}
