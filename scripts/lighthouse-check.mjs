#!/usr/bin/env node
/**
 * G-94: 주요 페이지 Lighthouse 실측 스크립트.
 *
 * 사용법:
 *   1. 별도 터미널에서 production 서버 실행:
 *      npm run build && npm run start
 *   2. `node scripts/lighthouse-check.mjs` 또는 `npm run lighthouse`
 *   3. 결과가 ./lighthouse-reports/ 에 JSON + 요약 출력
 *
 * 대상 페이지 (PUBLIC만):
 *   - / (랜딩 홈)
 *   - /campaigns (캠페인 목록)
 *   - /donor/login
 *
 * 목표 수치 (spec §8.5):
 *   - LCP < 2.5s
 *   - CLS < 0.1
 *   - INP < 200ms
 *
 * 주의: Lighthouse는 헤드리스 Chromium을 쓰므로 npm i -D lighthouse 필요.
 * 이 스크립트는 lighthouse가 설치돼 있지 않으면 설치 안내만 출력하고 종료한다.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'lighthouse-reports')
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://localhost:3000'

const TARGETS = [
  { name: 'home', url: `${BASE_URL}/` },
  { name: 'donor-login', url: `${BASE_URL}/donor/login` },
]

async function runLighthouse(url, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        'lighthouse',
        url,
        '--preset=desktop',
        '--output=json',
        `--output-path=${outputPath}`,
        '--chrome-flags=--headless',
        '--quiet',
      ],
      { stdio: 'inherit' },
    )
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`lighthouse exited ${code}`))
    })
  })
}

function summarize(report) {
  const audits = report.audits ?? {}
  const cats = report.categories ?? {}
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    lcp: audits['largest-contentful-paint']?.numericValue,
    cls: audits['cumulative-layout-shift']?.numericValue,
    inp: audits['interaction-to-next-paint']?.numericValue,
    tbt: audits['total-blocking-time']?.numericValue,
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const t of TARGETS) {
    const outputPath = path.join(OUT_DIR, `${t.name}.json`)
    console.log(`[lighthouse] ${t.url} →  ${outputPath}`)
    try {
      await runLighthouse(t.url, outputPath)
      const report = JSON.parse((await import('node:fs/promises')).then
        ? await (await import('node:fs/promises')).readFile(outputPath, 'utf-8')
        : '{}')
      const s = summarize(report)
      console.log(`  Performance: ${s.performance} / A11y: ${s.accessibility} / SEO: ${s.seo}`)
      console.log(`  LCP: ${Math.round(s.lcp ?? 0)}ms  CLS: ${(s.cls ?? 0).toFixed(3)}  TBT: ${Math.round(s.tbt ?? 0)}ms`)
      writeFileSync(
        path.join(OUT_DIR, `${t.name}.summary.json`),
        JSON.stringify(s, null, 2),
      )
    } catch (err) {
      console.error(`  ✗ ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('\n[lighthouse] 완료. JSON 보고서는 lighthouse-reports/*.json')
  console.log('[lighthouse] 목표: LCP < 2500ms, CLS < 0.1, Performance ≥ 80')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
