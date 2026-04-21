#!/usr/bin/env node
/**
 * G-73: variant 실렌더 썸네일 자동 생성.
 *
 * 각 variant의 `/admin/variant-preview/[id]` 페이지를 Playwright로 방문 →
 * viewport 캡처 → 300×200 JPEG로 다운스케일 → `public/landing-variants/[id].jpg` 저장.
 *
 * 사용법:
 *   1. dev 서버 실행: `npm run dev` (포트 3000)
 *   2. 관리자 계정 로그인이 저장된 storageState가 필요:
 *      - 로그인 후 /Users/.../.auth-state.json 생성
 *      - 또는 env 변수 ADMIN_EMAIL/ADMIN_PASSWORD로 자동 로그인
 *   3. `node scripts/capture-variant-thumbnails.mjs`
 *
 * 생성된 JPG는 SVG placeholder를 대체한다.
 * SVG는 git에 유지하되, JPG가 있으면 Variant 갤러리는 JPG 우선 사용 (별도 조치 필요).
 */
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'landing-variants')
const BASE_URL = process.env.PREVIEW_BASE_URL ?? 'http://localhost:3000'
const STORAGE_STATE = process.env.PLAYWRIGHT_AUTH_STATE ?? path.join(ROOT, '.auth-state.json')

// 현재 등록된 모든 variant id를 parse — register-all은 TS라 런타임에 직접 import 불가.
// 대신 각 *-schemas.ts 파일의 variant id를 패턴으로 수집하거나, 하드코딩 리스트 사용.
const VARIANT_IDS = [
  // hero
  'hero-minimal', 'hero-split-image', 'hero-fullscreen-image',
  'hero-fullscreen-video', 'hero-gallery', 'hero-stats-overlay',
  // stats
  'stats-grid', 'stats-inline', 'stats-cards', 'stats-countup', 'stats-big',
  // cta
  'cta-banner', 'cta-gradient', 'cta-split', 'cta-urgency', 'cta-fullscreen',
  // testimonials
  'testimonials-cards', 'testimonials-carousel', 'testimonials-wall',
  'testimonials-quote-large', 'testimonials-video',
  // logos
  'logos-grid', 'logos-marquee', 'logos-press', 'logos-partners',
  // faq
  'faq-accordion', 'faq-two-column', 'faq-categorized', 'faq-search',
  // impact
  'impact-alternating', 'impact-zigzag', 'impact-cards',
  'impact-storytelling', 'impact-before-after',
  // timeline
  'timeline-vertical', 'timeline-alternating', 'timeline-horizontal', 'timeline-milestones',
  // gallery
  'gallery-grid', 'gallery-masonry', 'gallery-lightbox',
  'gallery-carousel', 'gallery-fullbleed',
  // campaigns
  'campaigns-grid', 'campaigns-featured', 'campaigns-carousel',
  'campaigns-list', 'campaigns-masonry',
  // donation-tiers
  'tiers-cards', 'tiers-comparison', 'tiers-recommended',
  'tiers-horizontal', 'tiers-pricing-table',
  // team
  'team-grid', 'team-cards', 'team-featured', 'team-carousel', 'team-org-chart',
  // richtext
  'richtext-plain', 'richtext-boxed', 'richtext-quote',
  // financials (Phase 2)
  'financials-summary', 'financials-breakdown', 'financials-timeline', 'financials-transparency',
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  let storageState
  try {
    storageState = JSON.parse(readFileSync(STORAGE_STATE, 'utf-8'))
  } catch {
    console.error(`[capture] 인증 상태 파일 없음: ${STORAGE_STATE}`)
    console.error('[capture] 관리자 로그인 후 생성 필요. 예:')
    console.error('  const ctx = await browser.newContext(); await ctx.addCookies([...]); ')
    console.error('  또는 Playwright globalSetup으로 로그인 후 state 저장')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,  // retina → 다운스케일 시 선명도 확보
  })
  const page = await context.newPage()

  let ok = 0
  let fail = 0
  for (const id of VARIANT_IDS) {
    const url = `${BASE_URL}/admin/variant-preview/${id}`
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 10_000 })
      // 섹션 최상위 <section> 엘리먼트 캡처 (viewport 전체 아님)
      const section = await page.$('section')
      if (!section) {
        console.warn(`[${id}] <section> 없음 — 전체 viewport 캡처`)
        await page.screenshot({ path: path.join(OUT_DIR, `${id}.png`), type: 'png' })
      } else {
        const buf = await section.screenshot({ type: 'png' })
        // 300×200으로 직접 리사이즈는 Playwright만으론 불가 — sharp 미설치 전제로
        // 원본을 그대로 저장하고, Variant 갤러리 모달에서 CSS object-fit: cover로 처리
        writeFileSync(path.join(OUT_DIR, `${id}.png`), buf)
      }
      console.log(`✓ ${id}`)
      ok++
    } catch (err) {
      console.error(`✗ ${id}: ${err instanceof Error ? err.message : err}`)
      fail++
    }
  }

  await browser.close()
  console.log(`\n완료: ${ok} 성공 / ${fail} 실패`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
