import fs from "node:fs";
import path from "node:path";
import { DONATION_TYPE_CODES } from "./validation";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

/**
 * 기부금 영수증 PDF 생성.
 *
 * pdfmake 0.3.x 서버사이드 API 를 사용한다. 0.3.x 는 이전 버전과 달리 싱글톤 인스턴스를
 * `require('pdfmake')` 로 가져와 `setFonts(...)` → `createPdf(def).getBuffer()` 흐름을 따른다.
 * `@types/pdfmake` 는 아직 0.2.x 기반이라 `createPdf()`/`getBuffer()` 시그니처가 타입에
 *반영돼 있지 않다 — 안전한 지역 타입을 덧붙여 import any 없이 사용한다.
 *
 * 한글 렌더링을 위해 public/fonts/NotoSansKR-*.ttf 가 필요하다. 없으면 명확한 에러 메시지를
 * 던져 호출자가 사용자에게 설치 가이드를 보일 수 있게 한다.
 *
 * 수동 테스트:
 *   1) public/fonts/ 에 NotoSansKR-Regular.ttf, NotoSansKR-Bold.ttf 배치 (README 참고)
 *   2) 관리자로 로그인 후 /admin/members/<id> 에서 "영수증 발급" 클릭
 *   3) 브라우저가 receipt-RCP-YYYY-NNNNN.pdf 를 다운로드하는지 확인
 */

export type ReceiptData = {
  receiptCode: string;
  year: number;
  org: {
    name: string;
    businessNo: string | null;
    address: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    /** 법정 기재사항 — 없으면 '-' */
    representativeName?: string | null;
    doneeType?: string | null;
    doneeLegalBasis?: string | null;
    /** 별지 제45호서식 기부금 코드(10/40/41…) */
    donationTypeCode?: string | null;
  };
  member: {
    name: string;
    phone: string | null;
    birthDate: string | null;
  };
  totalAmount: number;
  payments: Array<{
    payDate: string;
    campaignTitle: string | null;
    amount: number;
  }>;
  issuedAt: string; // ISO date string
  /** 진위 확인 주소(QR) — 없으면 생략 */
  verifyUrl?: string | null;
};

type PdfOutputDocument = {
  getBuffer(): Promise<Buffer>;
};

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
    pdfmake.setFonts({
      NotoSansKR: {
        normal: regular,
        bold: bold,
        italics: regular,
        bolditalics: bold,
      },
    });
    // 영수증 문서는 외부 리소스를 참조하지 않는다 — SSRF 방어 목적으로 전 URL 차단.
    pdfmake.setUrlAccessPolicy(() => false);
    configured = true;
  }

  return pdfmake;
}

function formatAmount(n: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(n)}원`;
}

/**
 * 한글 기부금 영수증 PDF 를 생성해 Buffer 로 반환.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const pdfmake = getPdfMake();

  const paymentRows = data.payments.map((p) => [
    p.payDate,
    p.campaignTitle ?? "-",
    { text: formatAmount(p.amount), alignment: "right" as const },
  ]);

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: "NotoSansKR", fontSize: 10 },
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: "기부금 영수증",
        fontSize: 22,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 20],
      },
      {
        columns: [
          { text: `영수증 번호: ${data.receiptCode}`, fontSize: 10 },
          {
            text: `발급일: ${data.issuedAt.slice(0, 10)}`,
            fontSize: 10,
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 20],
      },
      // 기관 정보
      {
        text: "기부금을 받는 단체",
        bold: true,
        fontSize: 12,
        margin: [0, 10, 0, 6],
      },
      {
        table: {
          widths: ["25%", "75%"],
          body: [
            ["단체명", data.org.name],
            ["사업자등록번호(고유번호)", data.org.businessNo ?? "-"],
            ["대표자", data.org.representativeName ?? "-"],
            ["소재지", data.org.address ?? "-"],
            ["단체 구분", data.org.doneeType ?? "-"],
            ["지정 근거", data.org.doneeLegalBasis ?? "-"],
            ["기부금 유형", data.org.donationTypeCode ? `${data.org.donationTypeCode} ${DONATION_TYPE_CODES[data.org.donationTypeCode] ?? ""}`.trim() : "-"],
            ["연락처", data.org.contactPhone ?? "-"],
          ],
        },
        layout: "lightHorizontalLines",
      },
      // 기부자 정보
      {
        text: "기부자",
        bold: true,
        fontSize: 12,
        margin: [0, 16, 0, 6],
      },
      {
        table: {
          widths: ["25%", "75%"],
          body: [
            ["성명", data.member.name],
            ["연락처", data.member.phone ?? "-"],
            ["생년월일", data.member.birthDate ?? "-"],
          ],
        },
        layout: "lightHorizontalLines",
      },
      // 납입 내역
      {
        text: `${data.year}년 납입 내역`,
        bold: true,
        fontSize: 12,
        margin: [0, 16, 0, 6],
      },
      {
        table: {
          widths: ["25%", "*", "25%"],
          headerRows: 1,
          body: [
            [
              { text: "납입일", bold: true },
              { text: "캠페인", bold: true },
              { text: "금액", bold: true, alignment: "right" as const },
            ],
            ...paymentRows,
            [
              { text: "합계", bold: true, colSpan: 2 },
              {},
              {
                text: formatAmount(data.totalAmount),
                bold: true,
                alignment: "right" as const,
              },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        text: "\n위와 같이 기부금을 기부받았음을 증명합니다. 본 영수증은 소득세법·법인세법에 따른 기부금 공제 증빙용입니다.",
        fontSize: 9,
        color: "#666666",
        margin: [0, 30, 0, 0],
      },
      ...(data.verifyUrl
        ? [
            {
              columns: [
                { qr: data.verifyUrl, fit: 72, width: 80 },
                {
                  width: "*",
                  stack: [
                    { text: "영수증 진위 확인", bold: true, fontSize: 9 },
                    { text: data.verifyUrl, fontSize: 8, color: "#475569" },
                  ],
                  margin: [8, 8, 0, 0] as [number, number, number, number],
                },
              ],
              margin: [0, 16, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  };

  const doc = pdfmake.createPdf(docDefinition);
  return await doc.getBuffer();
}
