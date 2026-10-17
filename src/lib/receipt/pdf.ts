import fs from "node:fs";
import path from "node:path";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatKRW as formatAmount } from "@/lib/format";
import { maskRrn } from "./validation";

/**
 * 기부금영수증 PDF — 소득세법 시행규칙 [별지 제45호의2서식] <개정 2021. 3. 16.> 구성을 따른다.
 * (서식 원본: 국가법령정보센터. 국세청 주요서식 게시판의 HWP는 2017년판이라 ❹에 유형·기부장려금 칸이 남아 있다)
 *
 *   일련번호 / ❶ 기부자 / ❷ 기부금 단체 / ❸ 기부금 모집처 / ❹ 기부내용 / 신청인·수령인 확인
 *
 *  - ❸ 모집처: 단체에 직접 기부한 경우 적지 않는다(작성방법 2) — 이 시스템은 직접 기부만 받으므로 빈칸.
 *  - ❹ 기부내용: 코드·구분·연월일·내용(품명·수량·단가)·금액. 금전기부만 받으므로 구분은 "금전",
 *    내용은 현물기부에만 적어 빈칸(작성방법 4).
 *  - 주민등록번호는 뒷자리를 가려 표기한다(국세청 제출 자료에는 전체 번호가 들어간다 — nts-dataset).
 *
 * pdfmake 0.3.x 서버사이드 API: `require('pdfmake')` 싱글톤 → `setFonts` → `createPdf(def).getBuffer()`.
 * `@types/pdfmake`는 0.2.x 기반이라 지역 타입을 덧붙인다.
 * 한글 렌더링을 위해 public/fonts/NotoSansKR-*.ttf 가 필요하다.
 */

export type ReceiptData = {
  receiptCode: string;
  year: number;
  org: {
    name: string;
    businessNo: string | null;
    address: string | null;
    representativeName?: string | null;
    doneeLegalBasis?: string | null;
    /** 기부금 유형 코드(10/20/40/41/42/43) */
    donationTypeCode?: string | null;
  };
  member: {
    name: string;
    /** 주민등록번호(또는 사업자등록번호) 원문 — PDF에는 가려서 찍는다. 없으면 null */
    idNumber: string | null;
    address: string | null;
  };
  totalAmount: number;
  payments: Array<{
    payDate: string;
    campaignTitle: string | null;
    amount: number;
  }>;
  issuedAt: string; // ISO
  /** 진위 확인 주소(QR) — 없으면 생략 */
  verifyUrl?: string | null;
};

type PdfOutputDocument = { getBuffer(): Promise<Buffer> };
type PdfMakeSingleton = {
  setFonts(fonts: Record<string, { normal: string; bold: string; italics?: string; bolditalics?: string }>): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  createPdf(def: TDocumentDefinitions): PdfOutputDocument;
};

const fontsDir = path.join(process.cwd(), "public", "fonts");
let configured = false;

function getPdfMake(): PdfMakeSingleton {
  const regular = path.join(fontsDir, "NotoSansKR-Regular.ttf");
  const bold = path.join(fontsDir, "NotoSansKR-Bold.ttf");
  if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
    throw new Error(
      "Korean font files not found. Place NotoSansKR-Regular.ttf and NotoSansKR-Bold.ttf in public/fonts/ — see public/fonts/README.md for download instructions."
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require("pdfmake") as PdfMakeSingleton;
  if (!configured) {
    pdfmake.setFonts({ NotoSansKR: { normal: regular, bold, italics: regular, bolditalics: bold } });
    // 영수증 문서는 외부 리소스를 참조하지 않는다 — SSRF 방어 목적으로 전 URL 차단.
    pdfmake.setUrlAccessPolicy(() => false);
    configured = true;
  }
  return pdfmake;
}

/** 표기용 기부자 번호: 주민등록번호는 가리고, 사업자등록번호(10자리)는 그대로 */
export function displayDonorId(raw: string | null): string {
  if (!raw) return "";
  const v = raw.replace(/[^0-9]/g, "");
  if (v.length === 10) return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}`;
  return maskRrn(v);
}

function formatBizNo(raw: string | null): string {
  if (!raw) return "";
  const v = raw.replace(/[^0-9]/g, "");
  return v.length === 10 ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : raw;
}

/** "2026년 1월 15일" — 한국 시간 기준 */
export function koreanDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}년 ${get("month")}월 ${get("day")}일`;
}

const GRAY = "#eeeeee";
const label = (text: string, extra: Partial<Record<string, unknown>> = {}): TableCell =>
  ({ text, fillColor: GRAY, alignment: "center", ...extra }) as TableCell;
const num = (n: number, bold = false): TableCell => ({ text: formatAmount(n), alignment: "right", bold });

/** 섹션 제목 행(표 전체 폭) */
function sectionRow(title: string, cols: number): TableCell[] {
  return [{ text: title, bold: true, colSpan: cols, fillColor: "#dddddd" } as TableCell, ...Array(cols - 1).fill({})];
}

export function buildReceiptDocDefinition(data: ReceiptData): TDocumentDefinitions {
  const code = data.org.donationTypeCode ?? "";

  // ❶ 기부자 · ❷ 기부금 단체 · ❸ 모집처 — 4열(라벨·값·라벨·값)
  const partyTable: Content = {
    table: {
      widths: [90, "*", 90, "*"],
      body: [
        sectionRow("❶ 기부자", 4),
        [label("성명(법인명)"), data.member.name, label("주민등록번호\n(사업자등록번호)"), displayDonorId(data.member.idNumber)],
        [label("주소(소재지)"), { text: data.member.address ?? "", colSpan: 3 }, {}, {}],
        sectionRow("❷ 기부금 단체", 4),
        [label("단체명"), data.org.name, label("사업자등록번호\n(고유번호)"), formatBizNo(data.org.businessNo)],
        [label("소재지"), { text: data.org.address ?? "", colSpan: 3 }, {}, {}],
        [label("기부금공제대상\n기부금단체 근거법령"), { text: data.org.doneeLegalBasis ?? "", colSpan: 3 }, {}, {}],
        sectionRow("❸ 기부금 모집처(언론기관 등)", 4),
        [label("단체명"), "", label("사업자등록번호"), ""],
        [label("소재지"), { text: "", colSpan: 3 }, {}, {}],
      ],
    },
  };

  // ❹ 기부내용 — 코드·구분·연월일·내용(품명·수량·단가)·금액
  const rows: TableCell[][] = data.payments.map((p) => [
    { text: code, alignment: "center" },
    { text: "금전", alignment: "center" },
    { text: p.payDate, alignment: "center" },
    "",
    "",
    "",
    num(p.amount),
  ]);
  const contentTable: Content = {
    table: {
      headerRows: 3,
      widths: [50, 50, 70, "*", 50, 60, 80],
      body: [
        sectionRow("❹ 기부내용", 7),
        [
          label("코드", { rowSpan: 2 }),
          label("구분\n(금전 또는\n현물)", { rowSpan: 2 }),
          label("연월일", { rowSpan: 2 }),
          label("내용", { colSpan: 3 }),
          {},
          {},
          label("금액", { rowSpan: 2 }),
        ],
        [{}, {}, {}, label("품명"), label("수량"), label("단가"), {}],
        ...rows,
        [label("합계", { colSpan: 6, bold: true }), {}, {}, {}, {}, {}, num(data.totalAmount, true)],
      ],
    },
  };

  const issued = koreanDate(data.issuedAt);
  const receiverName = [data.org.name, data.org.representativeName ? `대표 ${data.org.representativeName}` : ""].filter(Boolean).join(" ");

  return {
    defaultStyle: { font: "NotoSansKR", fontSize: 9 },
    pageSize: "A4",
    pageMargins: [36, 36, 36, 40],
    footer: { text: "210mm×297mm", fontSize: 7, color: "#999999", alignment: "right", margin: [0, 10, 36, 0] },
    content: [
      { text: "■ 소득세법 시행규칙 [별지 제45호의2서식] <개정 2021. 3. 16.>", fontSize: 8, margin: [0, 0, 0, 6] },
      {
        table: { widths: [60, "*"], body: [[label("일련번호"), data.receiptCode]] },
        margin: [0, 0, 300, 10],
      },
      { text: "기 부 금  영 수 증", fontSize: 20, bold: true, alignment: "center", margin: [0, 0, 0, 12] },
      partyTable,
      { text: "", margin: [0, 6, 0, 0] },
      contentTable,
      {
        margin: [0, 16, 0, 0],
        stack: [
          {
            text: "「소득세법」 제34조, 「조세특례제한법」 제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.",
          },
          { text: issued, alignment: "right", margin: [0, 6, 0, 0] },
          { text: `신청인  ${data.member.name}   (서명 또는 인)`, alignment: "right", margin: [0, 4, 0, 0] },
        ],
      },
      {
        margin: [0, 18, 0, 0],
        stack: [
          { text: "위와 같이 기부금을 기부받았음을 증명합니다." },
          { text: issued, alignment: "right", margin: [0, 6, 0, 0] },
          { text: `기부금 수령인  ${receiverName}   (서명 또는 인)`, alignment: "right", bold: true, margin: [0, 4, 0, 0] },
        ],
      },
      ...(data.verifyUrl
        ? [
            {
              columns: [
                { qr: data.verifyUrl, fit: 64, width: 72 },
                {
                  width: "*",
                  stack: [
                    { text: "영수증 진위 확인", bold: true, fontSize: 8 },
                    { text: data.verifyUrl, fontSize: 7, color: "#475569" },
                  ],
                  margin: [8, 8, 0, 0] as [number, number, number, number],
                },
              ],
              margin: [0, 20, 0, 0] as [number, number, number, number],
            } as Content,
          ]
        : []),
    ],
  };
}

/** 기부금영수증 PDF 를 생성해 Buffer 로 반환 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const pdfmake = getPdfMake();
  return await pdfmake.createPdf(buildReceiptDocDefinition(data)).getBuffer();
}
