/**
 * G-D203: Feature flag 헬퍼.
 *
 * 현재 단계: 환경변수 `FEATURE_FLAGS`(JSON 문자열) 또는
 * 개별 `FEATURE_<NAME>` env 로 토글. Edge Config 전환은 후속.
 *
 * 사용:
 *   if (isFeatureEnabled('corporate_donors')) { ... }
 *
 * 보조:
 *   - 쿠키 기반 override: NEXT_PUBLIC_FEATURE_COOKIE=ff_<name>=1 을 받아 true 처리 가능
 *     (서버 컴포넌트에서는 cookies() 로 읽어 isFeatureEnabledServer 사용)
 */
import { cookies } from "next/headers";

const JSON_VAR = "FEATURE_FLAGS";

function loadFromJson(): Record<string, boolean> {
  const raw = process.env[JSON_VAR];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function envVarFor(name: string): string {
  return `FEATURE_${name.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
}

export function isFeatureEnabled(name: string): boolean {
  const jsonFlags = loadFromJson();
  if (name in jsonFlags) return jsonFlags[name]!;
  const v = process.env[envVarFor(name)];
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true";
}

/**
 * 서버 컴포넌트/라우트 내부에서만 사용 가능 (cookies() 의존).
 * 환경변수 off 여도 특정 쿠키(ff_<name>=1) 가 있으면 true.
 */
export async function isFeatureEnabledServer(name: string): Promise<boolean> {
  if (isFeatureEnabled(name)) return true;
  try {
    const cookieStore = await cookies();
    const v = cookieStore.get(`ff_${name}`)?.value;
    return v === "1";
  } catch {
    return false;
  }
}
