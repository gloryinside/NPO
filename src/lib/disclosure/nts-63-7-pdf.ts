/**
 * [별지 제63호의7서식] <개정 2022. 3. 18.> 연간 기부금 모금액 및 활용실적 명세서 — PDF (앞쪽)
 * 칸 배치·번호(①~㉟)·문구는 국가법령정보센터 서식 그대로. 내용이 많으면 표가 다음 쪽으로 이어진다(작성방법: 별지로 작성).
 */
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { renderPdf } from "@/lib/pdf/pdfmake";
import { totals, type Nts637Form } from "./nts-63-7";

const GRAY = "#eeeeee";
const head = (text: string): TableCell => ({ text, fillColor: GRAY, alignment: "center", bold: true });
const label = (text: string, extra: Record<string, unknown> = {}): TableCell => ({ text, fillColor: GRAY, ...extra }) as TableCell;
// 서식이 (단위: 원)이라 금액에 '원'을 붙이지 않는다
const amt = (n: number | null | undefined): TableCell => ({ text: n === null || n === undefined ? "" : n.toLocaleString("ko-KR"), alignment: "right" });
/** 월별 수입·지출은 없는 달을 빈칸으로 */
const amtOrBlank = (n: number): TableCell => amt(n === 0 ? null : n);
const cnt = (n: number | null | undefined): TableCell => ({ text: n === null || n === undefined ? "" : n.toLocaleString("ko-KR"), alignment: "right" });
const txt = (s: string): TableCell => ({ text: s });
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;
const BLANK_ROWS = 2;

function sectionTitle(title: string): Content {
  return {
    columns: [
      { text: title, bold: true },
      { text: "(단위: 원)", alignment: "right", fontSize: 8 },
    ],
    margin: [0, 10, 0, 3],
  };
}

function blank(cols: number): TableCell[] {
  return Array.from({ length: cols }, () => ({ text: " " }));
}

function padRows(rows: TableCell[][], cols: number): TableCell[][] {
  return rows.length > 0 ? rows : Array.from({ length: BLANK_ROWS }, () => blank(cols));
}

function koreanYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "      년      월      일";
  return `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
}

export function buildNts637DocDefinition(form: Nts637Form): TDocumentDefinitions {
  const b = form.basic;
  const t = totals(form);

  // 2. 수입·지출 — 왼쪽: 전기이월·1~7월, 오른쪽: 8~12월·합계·차기이월(서식 배치)
  const left: TableCell[][] = [
    [label("전기이월"), { text: "-", alignment: "center" }, { text: "-", alignment: "center" }, amt(form.carriedIn)],
    ...form.months.slice(0, 7).map((m) => [label(monthLabel(m.month)), amtOrBlank(m.income), amtOrBlank(m.expense), amt(m.balance)]),
  ];
  const right: TableCell[][] = [
    ...form.months.slice(7).map((m) => [label(monthLabel(m.month)), amtOrBlank(m.income), amtOrBlank(m.expense), amt(m.balance)]),
    [label("합계"), amt(t.income), amt(t.expense), txt("")],
    [label("차기이월"), { text: "-", alignment: "center" }, { text: "-", alignment: "center" }, amt(t.carriedOut)],
  ];
  while (right.length < left.length) right.push(blank(4));
  const monthBody: TableCell[][] = [
    [head("⑩ 월별"), head("⑪ 수입"), head("⑫ 지출"), head("⑬ 잔액"), head("월별"), head("수입"), head("지출"), head("잔액")],
    ...left.map((row, i) => [...row, ...right[i]!]),
  ];

  const domMonth = padRows(
    form.domesticByMonth.map((r) => [txt(monthLabel(r.month)), txt(r.purpose), cnt(r.count), txt(r.payee), amt(r.amount)]),
    5,
  );
  const domYear = padRows(
    form.domesticByYear.map((r) => [txt(`${r.year}년`), txt(r.purpose), cnt(r.beneficiaries), txt(r.payee), amt(r.amount)]),
    5,
  );
  const ovMonth = padRows(
    form.overseasByMonth.map((r) => [txt(monthLabel(r.month)), txt(r.country), txt(r.purpose), cnt(r.count), txt(r.payee), amt(r.amount)]),
    6,
  );
  const ovYear = padRows(
    form.overseasByYear.map((r) => [txt(`${r.year}년`), txt(r.country), txt(r.purpose), cnt(r.beneficiaries), txt(r.payee), amt(r.amount)]),
    6,
  );

  const table = (widths: (string | number)[], body: TableCell[][], headerRows = 1): Content => ({
    table: { widths, headerRows, body },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 2, paddingBottom: () => 2 },
  });

  return {
    pageSize: "A4",
    pageMargins: [36, 32, 36, 40],
    defaultStyle: { font: "NotoSansKR", fontSize: 8.5 },
    info: { title: `연간 기부금 모금액 및 활용실적 명세서 (${b.fiscalYear})` },
    footer: { text: "210mm×297mm[백상지 80g/㎡ 또는 중질지 80g/㎡]", alignment: "right", fontSize: 7, margin: [0, 10, 36, 0] },
    content: [
      { text: "■ 법인세법 시행규칙 [별지 제63호의7서식] <개정 2022. 3. 18.>", fontSize: 7.5 },
      {
        columns: [
          { text: "연간 기부금 모금액 및 활용실적 명세서", bold: true, fontSize: 15, alignment: "center", width: "*" },
          { text: "(앞쪽)", fontSize: 8, width: 40, alignment: "right" },
        ],
        margin: [0, 8, 0, 8],
      },

      { text: "1. 기본사항", bold: true, margin: [0, 0, 0, 3] },
      table(["18%", "32%", "20%", "30%"], [
        [label("① 법인명"), txt(b.orgName), label("② 사업자등록번호\n(고유번호)"), txt(b.businessNo)],
        [label("③ 대표자 성명"), txt(b.representative), label("④ 공익법인등 구분"), txt(b.orgCategory)],
        [label("⑤ 전자우편주소"), txt(b.email), label("⑥ 사업연도"), txt(b.fiscalYear)],
        [label("⑦ 전화번호"), txt(b.phone), label("⑧ 공익법인등 지정일"), txt(b.designatedAt)],
        [label("⑨ 소재지"), { text: b.address, colSpan: 3 }, {}, {}],
      ], 0),

      sectionTitle("2. 기부금의 수입ㆍ지출 명세"),
      table(["10%", "13%", "13%", "14%", "10%", "13%", "13%", "14%"], monthBody),

      sectionTitle("3. 기부금 지출 명세서(국내사업)"),
      table(["11%", "29%", "11%", "27%", "22%"], [
        [head("⑭ 지출월"), head("⑮ 지급목적"), head("⑯ 지급건수"), head("⑰ 대표 지급처명\n(단체명/개인)"), head("⑱ 금액")],
        ...domMonth,
      ]),
      { text: "", margin: [0, 3, 0, 0] },
      table(["11%", "29%", "11%", "27%", "22%"], [
        [head("⑲ 연도별"), head("⑳ 지급목적"), head("㉑ 수혜인원"), head("㉒ 대표 지급처명\n(단체명/개인)"), head("㉓ 금액")],
        ...domYear,
        [label("합 계", { colSpan: 2, alignment: "center" }), {}, cnt(t.domesticPeople), txt(""), amt(t.domestic)],
      ]),

      sectionTitle("4. 기부금 지출 명세서(국외사업)"),
      table(["10%", "14%", "22%", "10%", "24%", "20%"], [
        [head("㉔ 지출월"), head("㉕ 국가명"), head("㉖ 지급목적"), head("㉗ 지급건수"), head("㉘ 대표 지급처명\n(단체명/개인)"), head("㉙ 금액")],
        ...ovMonth,
      ]),
      { text: "", margin: [0, 3, 0, 0] },
      table(["10%", "14%", "22%", "10%", "24%", "20%"], [
        [head("㉚ 연도별"), head("㉛ 국가명"), head("㉜ 지급목적"), head("㉝ 수혜인원"), head("㉞ 대표 지급처명\n(단체명/개인)"), head("㉟ 금액")],
        ...ovYear,
        [label("합 계", { colSpan: 3, alignment: "center" }), {}, {}, cnt(t.overseasPeople), txt(""), amt(t.overseas)],
      ]),

      {
        text: "「법인세법 시행령」 제38조제8항 또는 제39조제5항에 따라 연간 기부금 모금액 및 활용실적을 공개합니다.",
        margin: [0, 14, 0, 6],
      },
      { text: koreanYmd(form.submittedOn), alignment: "right", margin: [0, 0, 0, 6] },
      {
        text: `제출인: ${form.submitter}          (공익법인등의 직인)     [인]`,
        alignment: "right",
      },
    ],
  };
}

export function generateNts637Pdf(form: Nts637Form): Promise<Buffer> {
  return renderPdf(buildNts637DocDefinition(form));
}
