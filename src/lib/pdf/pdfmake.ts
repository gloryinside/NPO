/**
 * 서버에서 PDF 만들기(pdfmake 0.3.x) — 기부금영수증·공시 서식이 같이 쓴다.
 *
 * pdfmake 0.3.x 서버사이드 API: `require('pdfmake')` 싱글톤 → `setFonts` → `createPdf(def).getBuffer()`.
 * `@types/pdfmake`는 0.2.x 기반이라 지역 타입을 덧붙인다.
 * 한글 렌더링을 위해 public/fonts/NotoSansKR-*.ttf 가 필요하다. 글꼴 이름은 "NotoSansKR".
 */
import fs from "node:fs";
import path from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

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
    // 서식 문서는 외부 리소스를 참조하지 않는다 — SSRF 방어 목적으로 전 URL 차단.
    pdfmake.setUrlAccessPolicy(() => false);
    configured = true;
  }
  return pdfmake;
}

export async function renderPdf(def: TDocumentDefinitions): Promise<Buffer> {
  return await getPdfMake().createPdf(def).getBuffer();
}
