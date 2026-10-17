/**
 * 연간 기부금 모금액 및 활용실적 명세서 — 법인세법 시행규칙 [별지 제63호의7서식] <개정 2022. 3. 18.>
 * 근거: 「법인세법 시행령」 제38조제8항 또는 제39조제5항 (공익법인등의 연간 기부금 모금액·활용실적 공개)
 * 서식 출처: 국가법령정보센터(law.go.kr) 법인세법 시행규칙 별지 서식
 *
 * 시스템에 있는 기록으로 초안을 채우고(buildDraft), 기관이 고친 뒤 저장·PDF로 낸다.
 *  - 수입: 결제 완료된 후원금(환불분 뺌), 지출: 사업 집행 내역(programs > program_expenses)
 *  - 공익법인등 구분·지정일·전기이월·국외사업·수혜인원은 시스템이 모르는 값이라 비워 두고 기관이 적는다
 */

/** 작성방법 1 — ④ 공익법인등 구분 */
export const ORG_CATEGORIES = [
  "한국학교",
  "전문모금기관",
  "사회복지법인",
  "어린이집",
  "학교(유치원)",
  "의료법인",
  "「민법」상 비영리법인",
  "비영리외국법인",
  "사회적협동조합",
  "공공기관등",
] as const;

/** 작성방법 3·4 — 연도별란에 단체명을 따로 적는 기준(1개 단체에 연간 이 금액 이상) */
export const NAMED_PAYEE_THRESHOLD = 1_000_000;

export type MonthRow = { month: string; income: number; expense: number; balance: number };
export type DomesticMonthRow = { month: string; purpose: string; count: number; payee: string; amount: number };
export type DomesticYearRow = { year: string; purpose: string; beneficiaries: number | null; payee: string; amount: number };
export type OverseasMonthRow = DomesticMonthRow & { country: string };
export type OverseasYearRow = DomesticYearRow & { country: string };

export type Nts637Form = {
  basic: {
    orgName: string;
    businessNo: string;
    representative: string;
    orgCategory: string;
    email: string;
    fiscalYear: string;
    phone: string;
    designatedAt: string;
    address: string;
  };
  carriedIn: number;
  months: MonthRow[];
  domesticByMonth: DomesticMonthRow[];
  domesticByYear: DomesticYearRow[];
  overseasByMonth: OverseasMonthRow[];
  overseasByYear: OverseasYearRow[];
  submittedOn: string; // YYYY-MM-DD
  submitter: string;
};

export type IncomeRecord = { date: string; amount: number };
export type ExpenseRecord = { date: string; purpose: string; payee: string | null; amount: number };

const won = (n: number) => Math.round(n);

/** 사업연도 개시월부터 종료월까지(작성방법 2) — 잔액은 전기이월에서 누적 */
export function buildMonths(year: number, carriedIn: number, income: IncomeRecord[], expense: ExpenseRecord[]): MonthRow[] {
  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const r of income) inc.set(r.date.slice(0, 7), (inc.get(r.date.slice(0, 7)) ?? 0) + r.amount);
  for (const r of expense) exp.set(r.date.slice(0, 7), (exp.get(r.date.slice(0, 7)) ?? 0) + r.amount);
  let balance = carriedIn;
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const income = won(inc.get(month) ?? 0);
    const expenseAmt = won(exp.get(month) ?? 0);
    balance += income - expenseAmt;
    return { month, income, expense: expenseAmt, balance };
  });
}

/** 국내사업 지출 — 지출월별·지급목적별(작성방법 3). 대표 지급처는 그 묶음에서 가장 많이 받은 곳 */
export function buildDomesticByMonth(expense: ExpenseRecord[]): DomesticMonthRow[] {
  const groups = new Map<string, { month: string; purpose: string; count: number; amount: number; payees: Map<string, number> }>();
  for (const r of expense) {
    const month = r.date.slice(0, 7);
    const key = `${month}\u0000${r.purpose}`;
    const g = groups.get(key) ?? { month, purpose: r.purpose, count: 0, amount: 0, payees: new Map() };
    g.count += 1;
    g.amount += r.amount;
    if (r.payee) g.payees.set(r.payee, (g.payees.get(r.payee) ?? 0) + r.amount);
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.month.localeCompare(b.month) || a.purpose.localeCompare(b.purpose, "ko"))
    .map((g) => ({ month: g.month, purpose: g.purpose, count: g.count, payee: topPayee(g.payees), amount: won(g.amount) }));
}

/**
 * 국내사업 지출 — 연간 지급목적별(작성방법 3). 1개 단체에 연간 100만원 이상 준 경우는 그 단체를 따로 한 줄로.
 * 수혜인원은 시스템이 모르므로 비워 둔다(기관이 적는다).
 */
export function buildDomesticByYear(year: number, expense: ExpenseRecord[]): DomesticYearRow[] {
  const byPayee = new Map<string, number>();
  for (const r of expense) if (r.payee) byPayee.set(`${r.purpose}\u0000${r.payee}`, (byPayee.get(`${r.purpose}\u0000${r.payee}`) ?? 0) + r.amount);
  const named = new Set([...byPayee].filter(([, v]) => v >= NAMED_PAYEE_THRESHOLD).map(([k]) => k));

  const rest = new Map<string, { amount: number; payees: Map<string, number> }>();
  const rows: DomesticYearRow[] = [];
  for (const k of [...named].sort()) {
    const [purpose, payee] = k.split("\u0000") as [string, string];
    rows.push({ year: String(year), purpose, beneficiaries: null, payee, amount: won(byPayee.get(k)!) });
  }
  for (const r of expense) {
    if (r.payee && named.has(`${r.purpose}\u0000${r.payee}`)) continue;
    const g = rest.get(r.purpose) ?? { amount: 0, payees: new Map() };
    g.amount += r.amount;
    if (r.payee) g.payees.set(r.payee, (g.payees.get(r.payee) ?? 0) + r.amount);
    rest.set(r.purpose, g);
  }
  for (const [purpose, g] of [...rest].sort((a, b) => a[0].localeCompare(b[0], "ko"))) {
    rows.push({ year: String(year), purpose, beneficiaries: null, payee: topPayee(g.payees), amount: won(g.amount) });
  }
  return rows;
}

function topPayee(payees: Map<string, number>): string {
  let best = "";
  let max = -1;
  for (const [name, amount] of payees) if (amount > max) [best, max] = [name, amount];
  return best;
}

export function buildDraft(args: {
  year: number;
  org: { name: string; businessNo: string | null; representative: string | null; email: string | null; phone: string | null; address: string | null };
  income: IncomeRecord[];
  expense: ExpenseRecord[];
  today: string;
}): Nts637Form {
  const { year, org, income, expense } = args;
  return {
    basic: {
      orgName: org.name,
      businessNo: org.businessNo ?? "",
      representative: org.representative ?? "",
      orgCategory: "",
      email: org.email ?? "",
      fiscalYear: `${year}년`,
      phone: org.phone ?? "",
      designatedAt: "",
      address: org.address ?? "",
    },
    carriedIn: 0,
    months: buildMonths(year, 0, income, expense),
    domesticByMonth: buildDomesticByMonth(expense),
    domesticByYear: buildDomesticByYear(year, expense),
    overseasByMonth: [],
    overseasByYear: [],
    submittedOn: args.today,
    submitter: org.representative ?? "",
  };
}

/** 합계 — 화면·PDF 공통 */
export function totals(form: Nts637Form) {
  const income = form.months.reduce((s, m) => s + m.income, 0);
  const expense = form.months.reduce((s, m) => s + m.expense, 0);
  const domestic = form.domesticByYear.reduce((s, r) => s + r.amount, 0);
  const overseas = form.overseasByYear.reduce((s, r) => s + r.amount, 0);
  const domesticPeople = form.domesticByYear.reduce((s, r) => s + (r.beneficiaries ?? 0), 0);
  const overseasPeople = form.overseasByYear.reduce((s, r) => s + (r.beneficiaries ?? 0), 0);
  return { income, expense, carriedOut: form.carriedIn + income - expense, domestic, overseas, domesticPeople, overseasPeople };
}

/** 저장 전에 고칠 점 — 막지는 않고 화면에 알린다 */
export function checkForm(form: Nts637Form): string[] {
  const t = totals(form);
  const warn: string[] = [];
  if (!form.basic.orgCategory) warn.push("④ 공익법인등 구분을 골라 주세요.");
  if (!form.basic.designatedAt) warn.push("⑧ 공익법인등 지정일을 적어 주세요.");
  if (!form.basic.businessNo) warn.push("② 사업자등록번호(고유번호)를 적어 주세요.");
  if (t.domestic + t.overseas !== t.expense) {
    warn.push(`지출 명세서 합계(국내 ${t.domestic.toLocaleString("ko-KR")}원 + 국외 ${t.overseas.toLocaleString("ko-KR")}원)가 월별 지출 합계(${t.expense.toLocaleString("ko-KR")}원)와 다릅니다.`);
  }
  if (form.domesticByYear.some((r) => r.beneficiaries === null)) warn.push("국내사업 연도별 수혜인원을 적어 주세요(연간 실제 인원).");
  return warn;
}

export function parseYear(v: string | null): number | null {
  const y = Number(v);
  return v && Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
}

// ── 저장할 때 들어온 값 정리 ───────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const intOrNull = (v: unknown) => (v === null || v === "" || v === undefined ? null : Math.max(0, int(v)));
const rows = <T>(v: unknown, max: number, map: (r: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).map((r) => map((r ?? {}) as Record<string, unknown>)) : [];

export function parseForm(raw: unknown): { ok: true; value: Nts637Form } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "서식 내용이 없습니다." };
  const f = raw as Record<string, unknown>;
  const b = (f.basic ?? {}) as Record<string, unknown>;
  const months = rows(f.months, 12, (r) => ({ month: str(r.month, 7), income: int(r.income), expense: int(r.expense), balance: 0 }));
  if (months.length !== 12 || months.some((m) => !/^\d{4}-\d{2}$/.test(m.month))) {
    return { ok: false, error: "월별 수입·지출은 12개월이 모두 있어야 합니다." };
  }
  const carriedIn = int(f.carriedIn);
  // 잔액은 저장할 때 다시 계산한다(작성방법 2: 전기이월에서 누적)
  let bal = carriedIn;
  for (const m of months) {
    bal += m.income - m.expense;
    m.balance = bal;
  }
  const category = str(b.orgCategory, 30);
  if (category && !(ORG_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: "공익법인등 구분은 서식의 구분 중에서 골라 주세요." };
  }
  const domesticMonth = (r: Record<string, unknown>) => ({ month: str(r.month, 7), purpose: str(r.purpose, 60), count: Math.max(0, int(r.count)), payee: str(r.payee, 60), amount: int(r.amount) });
  const domesticYear = (r: Record<string, unknown>) => ({ year: str(r.year, 4), purpose: str(r.purpose, 60), beneficiaries: intOrNull(r.beneficiaries), payee: str(r.payee, 60), amount: int(r.amount) });
  return {
    ok: true,
    value: {
      basic: {
        orgName: str(b.orgName, 100),
        businessNo: str(b.businessNo, 20),
        representative: str(b.representative, 50),
        orgCategory: category,
        email: str(b.email, 100),
        fiscalYear: str(b.fiscalYear, 20),
        phone: str(b.phone, 30),
        designatedAt: str(b.designatedAt, 20),
        address: str(b.address, 200),
      },
      carriedIn,
      months,
      domesticByMonth: rows(f.domesticByMonth, 500, domesticMonth),
      domesticByYear: rows(f.domesticByYear, 200, domesticYear),
      overseasByMonth: rows(f.overseasByMonth, 500, (r) => ({ ...domesticMonth(r), country: str(r.country, 40) })),
      overseasByYear: rows(f.overseasByYear, 200, (r) => ({ ...domesticYear(r), country: str(r.country, 40) })),
      submittedOn: /^\d{4}-\d{2}-\d{2}$/.test(str(f.submittedOn, 10)) ? str(f.submittedOn, 10) : "",
      submitter: str(f.submitter, 50),
    },
  };
}
