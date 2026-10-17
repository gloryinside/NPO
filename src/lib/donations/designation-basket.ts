/**
 * 여러 사업 담기 — 후원자가 한 번에 여러 사업을 골라 사업마다 금액을 정한다(굿네이버스식).
 *
 *  - 고를 수 있는 사업은 캠페인 신청서 설정(form_settings.designations)에 있는 것만
 *  - 결제·약정에는 고른 나눔을 그대로 저장한다(designation_split)
 *  - 회계 배분(payment_program_allocations)은 사업에 연결된 항목만, 후원자가 고른 비율대로 한다(캠페인 배분 규칙보다 먼저).
 *    정기후원 금액이 나중에 바뀌어도 같은 비율로 나눈다.
 */

export const BASKET_MAX_ITEMS = 10;

export type DesignationOption = { key: string; label: string; programId?: string | null };

export type SplitItem = { key: string; label: string; amount: number; programId?: string | null };

export type BasketResult =
  | { ok: true; items: SplitItem[]; total: number }
  | { ok: false; error: string };

/** 신청서에서 온 담기 목록을 캠페인 설정과 맞춰 검증한다. 같은 사업은 한 번만. */
export function parseBasket(input: unknown, options: DesignationOption[]): BasketResult {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "후원할 사업을 하나 이상 골라 주세요." };
  if (input.length > BASKET_MAX_ITEMS) return { ok: false, error: `사업은 ${BASKET_MAX_ITEMS}개까지 고를 수 있어요.` };

  const byKey = new Map(options.map((o) => [o.key, o]));
  const seen = new Set<string>();
  const items: SplitItem[] = [];
  for (const raw of input) {
    const r = (raw ?? {}) as { key?: unknown; amount?: unknown };
    const opt = typeof r.key === "string" ? byKey.get(r.key) : undefined;
    if (!opt) return { ok: false, error: "선택할 수 없는 사업이 들어 있어요. 화면을 새로 고쳐 주세요." };
    if (seen.has(opt.key)) return { ok: false, error: "같은 사업이 두 번 들어 있어요." };
    const amount = Number(r.amount);
    if (!Number.isInteger(amount) || amount < 1000 || amount > 100_000_000) {
      return { ok: false, error: `${opt.label} 금액은 1,000원 이상으로 정해 주세요.` };
    }
    seen.add(opt.key);
    items.push({ key: opt.key, label: opt.label, amount, programId: opt.programId ?? null });
  }
  return { ok: true, items, total: items.reduce((s, i) => s + i.amount, 0) };
}

/** 한 사업만 고른 경우(기존 방식)도 같은 모양으로 — 설정에 없는 값은 버린다 */
export function singleDesignation(key: unknown, options: DesignationOption[]): DesignationOption | null {
  if (typeof key !== "string" || !key) return null;
  return options.find((o) => o.key === key) ?? null;
}

/**
 * 저장된 나눔을 실제 결제 금액에 맞춘다 — 정기후원 금액이 바뀌어도 후원자가 고른 비율은 그대로.
 * 원 단위 반올림 차이는 마지막 항목이 흡수해 합계가 정확히 맞는다.
 */
export function scaleSplit(split: SplitItem[], paymentAmount: number): SplitItem[] {
  const base = split.reduce((s, i) => s + i.amount, 0);
  if (base <= 0 || paymentAmount <= 0) return [];
  if (base === paymentAmount) return split;
  let given = 0;
  return split.map((item, idx) => {
    const amount = idx === split.length - 1
      ? paymentAmount - given
      : Math.round((paymentAmount * item.amount) / base);
    given += amount;
    return { ...item, amount };
  });
}

/**
 * 결제 금액을 사업(programs)에 배분한다.
 * 사업에 연결되지 않은 항목의 몫은 배분하지 않는다 — 관리자가 결제 화면에서 직접 배분한다.
 * (연결된 항목이 하나도 없으면 빈 목록 → 캠페인 배분 규칙(program_funding)을 쓴다)
 */
export function allocateSplit(
  split: SplitItem[],
  paymentAmount: number,
): { programId: string; amount: number }[] {
  // 같은 사업에 연결된 항목이 여럿이면 합친다
  const merged = new Map<string, number>();
  for (const s of scaleSplit(split, paymentAmount)) {
    if (!s.programId || s.amount <= 0) continue;
    merged.set(s.programId, (merged.get(s.programId) ?? 0) + s.amount);
  }
  return [...merged].map(([programId, amount]) => ({ programId, amount }));
}

/** 저장된 jsonb 값을 읽는다 — 모양이 다르면 빈 목록 */
export function readSplit(value: unknown): SplitItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = (v ?? {}) as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.label !== "string" || typeof r.amount !== "number") return [];
    return [{ key: r.key, label: r.label, amount: r.amount, programId: typeof r.programId === "string" ? r.programId : null }];
  });
}
