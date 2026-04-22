import fs from 'node:fs'
import path from 'node:path'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import type { DonorImpact } from './impact'

/**
 * Phase 5-A: 후원자 연간 임팩트 리포트 PDF.
 * 기존 기부금 영수증 pdfmake 파이프라인을 재활용.
 *
 * 주의: 영수증과 달리 이건 "마케팅/감사 문서" 성격이라 법적 증빙이 아님.
 *       상단에 명확한 문구로 안내한다.
 */

export interface ImpactReportData {
  org: { name: string }
  member: { name: string }
  year: number        // 대상 연도. "전체" 모드면 0
  impact: DonorImpact
  issuedAt: string    // ISO
}

type PdfOutputDocument = { getBuffer(): Promise<Buffer> }
type PdfMakeSingleton = {
  setFonts(fonts: Record<string, { normal: string; bold: string; italics?: string; bolditalics?: string }>): void
  setUrlAccessPolicy(cb: (url: string) => boolean): void
  createPdf(def: TDocumentDefinitions): PdfOutputDocument
}

const fontsDir = path.join(process.cwd(), 'public', 'fonts')
let configured = false

function getPdfMake(): PdfMakeSingleton {
  const regular = path.join(fontsDir, 'NotoSansKR-Regular.ttf')
  const bold = path.join(fontsDir, 'NotoSansKR-Bold.ttf')
  if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
    throw new Error(
      'Korean font files not found. Place NotoSansKR-Regular.ttf and NotoSansKR-Bold.ttf in public/fonts/',
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require('pdfmake') as PdfMakeSingleton
  if (!configured) {
    pdfmake.setFonts({
      NotoSansKR: { normal: regular, bold, italics: regular, bolditalics: bold },
    })
    pdfmake.setUrlAccessPolicy(() => false)
    configured = true
  }
  return pdfmake
}

function formatKRW(n: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(n)}원`
}

export async function generateImpactPdf(data: ImpactReportData): Promise<Buffer> {
  const pdfmake = getPdfMake()
  const { org, member, year, impact, issuedAt } = data

  const yearLabel = year > 0 ? `${year}년` : '전체 기간'

  // 캠페인별 테이블 (상위 5개)
  const campaignRows = [
    [
      { text: '캠페인', bold: true },
      { text: '건수', bold: true, alignment: 'center' as const },
      { text: '금액', bold: true, alignment: 'right' as const },
    ],
    ...impact.byCampaign.slice(0, 5).map((c) => [
      c.title,
      { text: `${c.count}회`, alignment: 'center' as const },
      { text: formatKRW(c.amount), alignment: 'right' as const },
    ]),
  ]

  const yearRows = [
    [
      { text: '연도', bold: true },
      { text: '건수', bold: true, alignment: 'center' as const },
      { text: '금액', bold: true, alignment: 'right' as const },
    ],
    ...impact.byYear.map((y) => [
      `${y.year}년`,
      { text: `${y.count}회`, alignment: 'center' as const },
      { text: formatKRW(y.amount), alignment: 'right' as const },
    ]),
  ]

  const doc: TDocumentDefinitions = {
    defaultStyle: { font: 'NotoSansKR', fontSize: 10 },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: `${member.name}님의 후원 리포트`,
        fontSize: 20,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      {
        text: `${yearLabel} · ${org.name}`,
        fontSize: 11,
        color: '#64748b',
        alignment: 'center',
        margin: [0, 0, 0, 28],
      },

      // 핵심 지표 박스 3개 (columns)
      {
        columns: [
          metricBox('누적 후원액', formatKRW(impact.totalAmount)),
          metricBox('후원 건수', `${impact.paymentCount}회`),
          metricBox('함께한 기간', `${impact.activeMonths}개월`),
        ],
        margin: [0, 0, 0, 24],
      },

      // 감사 문구
      {
        text: '당신의 후원이 만든 변화',
        fontSize: 14,
        bold: true,
        margin: [0, 8, 0, 8],
      },
      {
        text: `${member.name}님, 그동안 소중한 후원에 깊이 감사드립니다.\n` +
              `총 ${formatKRW(impact.totalAmount)}의 후원은 ${org.name}의 활동에 실질적인 힘이 되었습니다.`,
        margin: [0, 0, 0, 20],
        lineHeight: 1.5,
      },

      // 캠페인별
      ...(impact.byCampaign.length > 0 ? [
        { text: '참여하신 캠페인 (상위 5개)', fontSize: 12, bold: true, margin: [0, 8, 0, 8] as [number, number, number, number] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 60, 100],
            body: campaignRows,
          },
          layout: 'lightHorizontalLines' as const,
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
      ] : []),

      // 연도별
      ...(impact.byYear.length > 0 ? [
        { text: '연도별 후원 내역', fontSize: 12, bold: true, margin: [0, 8, 0, 8] as [number, number, number, number] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 60, 100],
            body: yearRows,
          },
          layout: 'lightHorizontalLines' as const,
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
      ] : []),

      // 푸터 안내
      {
        text: '본 리포트는 후원자 감사 목적으로 자동 생성된 문서이며, 세법상 기부금 영수증이 아닙니다.',
        fontSize: 8,
        color: '#94a3b8',
        italics: true,
        margin: [0, 24, 0, 4],
      },
      {
        text: `발급일: ${issuedAt.slice(0, 10)}`,
        fontSize: 8,
        color: '#94a3b8',
      },
    ],
  }

  const result = pdfmake.createPdf(doc)
  return result.getBuffer()
}

function metricBox(label: string, value: string) {
  return {
    stack: [
      { text: label, fontSize: 9, color: '#64748b', alignment: 'center' as const },
      { text: value, fontSize: 16, bold: true, color: '#7c3aed', alignment: 'center' as const, margin: [0, 4, 0, 0] as [number, number, number, number] },
    ],
    margin: [4, 0, 4, 0] as [number, number, number, number],
  }
}
