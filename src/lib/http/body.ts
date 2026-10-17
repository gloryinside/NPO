import { NextResponse } from "next/server";

/**
 * API 요청 본문(JSON 객체) 읽기 — 라우트마다 try/catch로 쓰던 것을 한곳에 모았다.
 *
 *   const parsed = await readJsonObject<{ name?: unknown }>(req);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.body;
 *
 * JSON이 아니거나 객체가 아니면(null·배열·숫자) 400. 예전엔 `null` 본문이 들어오면
 * body.x 에서 TypeError가 나 500이 됐다.
 */
export async function readJsonObject<T extends object = Record<string, unknown>>(
  req: Request,
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    return { ok: false, response: invalid() };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, response: invalid() };
  }
  return { ok: true, body: value as T };
}

function invalid() {
  return NextResponse.json({ error: "요청 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요." }, { status: 400 });
}
