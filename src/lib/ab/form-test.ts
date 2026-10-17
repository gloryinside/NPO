/**
 * 후원 신청 화면 A/B 비교 — 금액 버튼(과 기본 후원 유형)을 두 안으로 나눠 보여 주고 결과를 비교한다.
 *
 *  - 방문자 배정: 브라우저에 둔 임의 id + 실험 id 를 해시해 A/B — 같은 사람은 늘 같은 안을 본다
 *  - 노출: 방문자마다 한 번(form_ab_views), 신청: payments.ab_test_id/ab_variant
 *  - 판정: 두 비율 z 검정(전환율). 표본이 적으면 판정하지 않는다
 */

export const AB_VARIANTS = ["A", "B"] as const;
export type AbVariant = (typeof AB_VARIANTS)[number];

export type VariantSettings = {
  key: AbVariant;
  /** 비우면 캠페인 신청서 설정의 금액 버튼 */
  amountPresets: number[];
  /** 비우면 캠페인 설정의 첫 유형 */
  defaultType: "regular" | "onetime" | null;
};

export type ActiveTest = { id: string; variants: VariantSettings[] };

/** FNV-1a 32비트 — 브라우저·서버 어디서나 같은 값 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function assignVariant(testId: string, visitorId: string): AbVariant {
  return fnv1a(`${testId}:${visitorId}`) % 2 === 0 ? "A" : "B";
}

export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
}

/** 금액 버튼: 1,000원 이상 정수, 2~6개, 중복 없음 */
function parsePresets(v: unknown): number[] | null {
  if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) return [];
  if (!Array.isArray(v)) return null;
  const nums = v.map(Number);
  if (nums.length < 2 || nums.length > 6) return null;
  if (nums.some((n) => !Number.isInteger(n) || n < 1000 || n > 100_000_000)) return null;
  if (new Set(nums).size !== nums.length) return null;
  return nums;
}

export function parseVariants(raw: unknown): { ok: true; value: VariantSettings[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length !== 2) return { ok: false, error: "A안과 B안을 모두 정해 주세요." };
  const out: VariantSettings[] = [];
  for (const [i, key] of AB_VARIANTS.entries()) {
    const r = (raw[i] ?? {}) as Record<string, unknown>;
    const amountPresets = parsePresets(r.amountPresets);
    if (!amountPresets) return { ok: false, error: `${key}안 금액 버튼은 1,000원 이상으로 2~6개, 겹치지 않게 적어 주세요.` };
    const t = r.defaultType;
    const defaultType = t === "regular" || t === "onetime" ? t : null;
    out.push({ key, amountPresets, defaultType });
  }
  if (JSON.stringify(out[0]) === JSON.stringify({ ...out[1], key: "A" })) {
    return { ok: false, error: "A안과 B안이 같습니다. 비교할 차이를 두세요." };
  }
  return { ok: true, value: out };
}

export type VariantStats = { views: number; conversions: number; amount: number };
export type AbResult = {
  rate: Record<AbVariant, number>;
  avgAmount: Record<AbVariant, number>;
  /** 양측 p값 — 표본이 적으면 null */
  pValue: number | null;
  /** 의미 있는 차이가 있는 쪽(p<0.05) — 없으면 null */
  leader: AbVariant | null;
  enoughData: boolean;
};

/** 표본 기준 — 안마다 노출 100명·신청 10건 이상 */
export const MIN_VIEWS = 100;
export const MIN_CONVERSIONS = 10;

/** 표준정규 누적분포(Abramowitz–Stegun 7.1.26) */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function compareVariants(a: VariantStats, b: VariantStats): AbResult {
  const rate = { A: a.views ? a.conversions / a.views : 0, B: b.views ? b.conversions / b.views : 0 };
  const avgAmount = { A: a.conversions ? Math.round(a.amount / a.conversions) : 0, B: b.conversions ? Math.round(b.amount / b.conversions) : 0 };
  const enoughData = a.views >= MIN_VIEWS && b.views >= MIN_VIEWS && a.conversions + b.conversions >= MIN_CONVERSIONS * 2;
  if (!enoughData) return { rate, avgAmount, pValue: null, leader: null, enoughData };
  const pooled = (a.conversions + b.conversions) / (a.views + b.views);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.views + 1 / b.views));
  if (se === 0) return { rate, avgAmount, pValue: 1, leader: null, enoughData };
  const z = (rate.B - rate.A) / se;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));
  return { rate, avgAmount, pValue, leader: pValue < 0.05 ? (z > 0 ? "B" : "A") : null, enoughData };
}
