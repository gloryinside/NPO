/**
 * 회비 — 협회·조합처럼 회원에게 정해진 회비를 받는 기관용. 후원금(기부금)과 따로 관리한다
 * (기부금영수증 대상이 아니고 회계 분개도 다르다 — membership_fee_payments).
 *
 * 회원은 회비 종류(membership_fee_plans) 하나에 가입하고, 낸 만큼 '납부 만료일(fee_paid_until)'이 늘어난다.
 * 자동 청구(카드·계좌)는 결제 연동 때 붙인다 — 지금은 납부 기록과 미납 명단.
 */

export const FEE_CYCLES = ["annual", "monthly", "one_time"] as const;
export type FeeCycle = (typeof FEE_CYCLES)[number];

export const FEE_CYCLE_LABEL: Record<FeeCycle, string> = {
  annual: "연회비",
  monthly: "월회비",
  one_time: "평생(1회)",
};

/** 평생 회비의 납부 만료일 — 날짜 칸이라 먼 미래로 둔다 */
export const LIFETIME_UNTIL = "2099-12-31";

/** 만료 전 이 기간 안이면 '곧 만료' */
export const DUE_SOON_DAYS = 30;

export type FeeStatus = "paid" | "due_soon" | "overdue" | "unpaid";

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  paid: "납부 완료",
  due_soon: "곧 만료",
  overdue: "기간 지남",
  unpaid: "낸 적 없음",
};

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 달 더하기 — 1월 31일 + 1개월은 2월 말일 */
function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * 이번 납부가 덮는 기간 — 아직 기간이 남았으면 그 다음 날부터 이어 붙이고, 끊겼으면 낸 날부터.
 * 예: 2025-12-31까지 낸 회원이 2025-12-20에 연회비를 내면 2026-01-01 ~ 2026-12-31.
 */
export function nextPeriod(cycle: FeeCycle, paidUntil: string | null, paidDate: string): { start: string; end: string } {
  const start = paidUntil && paidUntil >= paidDate ? addDays(paidUntil, 1) : paidDate;
  if (cycle === "one_time") return { start, end: LIFETIME_UNTIL };
  const months = cycle === "annual" ? 12 : 1;
  return { start, end: addDays(addMonths(start, months), -1) };
}

export function feeStatus(paidUntil: string | null, today: string): FeeStatus {
  if (!paidUntil) return "unpaid";
  if (paidUntil < today) return "overdue";
  return paidUntil <= addDays(today, DUE_SOON_DAYS) ? "due_soon" : "paid";
}

export type PlanInput = { name: string; feeAmount: number; cycle: FeeCycle; description: string | null };

export function parsePlanInput(body: Record<string, unknown>): { ok: true; value: PlanInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) return { ok: false, error: "회비 이름을 40자 안으로 적어 주세요." };
  const feeAmount = Number(body.feeAmount);
  if (!Number.isInteger(feeAmount) || feeAmount < 1 || feeAmount > 100_000_000) return { ok: false, error: "금액을 원 단위로 적어 주세요." };
  const cycle = body.cycle as FeeCycle;
  if (!FEE_CYCLES.includes(cycle)) return { ok: false, error: "납부 주기를 골라 주세요." };
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 200) : null;
  return { ok: true, value: { name, feeAmount, cycle, description } };
}

export const FEE_PAY_METHODS = ["transfer", "cash", "card", "cms", "other"] as const;
export const FEE_PAY_METHOD_LABEL: Record<(typeof FEE_PAY_METHODS)[number], string> = {
  transfer: "계좌이체",
  cash: "현금",
  card: "카드",
  cms: "자동이체",
  other: "기타",
};

export type FeePaymentInput = { memberId: string; amount: number; paidDate: string; method: string; notes: string | null };

export function parseFeePayment(body: Record<string, unknown>, today: string): { ok: true; value: FeePaymentInput } | { ok: false; error: string } {
  const memberId = typeof body.memberId === "string" && /^[0-9a-f-]{36}$/i.test(body.memberId) ? body.memberId : null;
  if (!memberId) return { ok: false, error: "회원을 골라 주세요." };
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) return { ok: false, error: "금액을 원 단위로 적어 주세요." };
  const paidDate = typeof body.paidDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paidDate) ? body.paidDate : "";
  if (!paidDate || Number.isNaN(Date.parse(paidDate))) return { ok: false, error: "낸 날짜를 확인해 주세요." };
  if (paidDate > today) return { ok: false, error: "앞으로의 날짜는 적을 수 없습니다." };
  const method = typeof body.method === "string" && (FEE_PAY_METHODS as readonly string[]).includes(body.method) ? body.method : "";
  if (!method) return { ok: false, error: "납부 방법을 골라 주세요." };
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 200) : null;
  return { ok: true, value: { memberId, amount, paidDate, method, notes } };
}
