# GAP 분석 — Phase 4-D 성능·신뢰성 하드닝 (2026-04-22)

Phase 4-A/B에서 발굴된 GAP 5건(G-87~G-91)을 한 세션에 해소.

---

## 해소 요약

### G-91 — settings 캐싱
**문제**: `getOrgSettings(supabase, orgId)`가 서버 컴포넌트마다 매번 DB 왕복. 한 요청 내 여러 컴포넌트가 호출 시 중복.
**해결**: React `cache()` 래핑 `getOrgSettingsCached(orgId)` 추가.
- 인자로 orgId만 받고 내부에서 `createSupabaseAdminClient` 호출 (클라이언트 인스턴스를 캐시 키로 쓸 수 없음)
- 같은 요청 트리 내 동일 orgId → DB 쿼리 1회
- `/donor/impact`, `/admin/settings` 적용
- cron 등 서버 컴포넌트 외부에서는 기존 `getOrgSettings` 계속 사용

### G-87 — auto-close N+1 쿼리 최적화
**문제**: active goal 캠페인마다 `payments` 합계 쿼리 → 캠페인 N개면 N+1 쿼리.
**해결**: 단일 batch 쿼리 + 메모리 합산.
```ts
const { data } = await supabase
  .from('payments')
  .select('campaign_id, amount')
  .in('campaign_id', campaignIds)
  .eq('pay_status', 'paid')

// Map<campaignId, sum>으로 집계
```
- 캠페인 100개 → 쿼리 1개로 감소
- 응답 시간 단축 + DB 부하 경감

### G-89 — 리포트 페이지 recharts dynamic import
**문제**: `/admin/campaigns/[id]/report`의 `ReportDailyChart`가 직접 import → 다른 admin 페이지 번들에 recharts 포함 가능성.
**해결**: `next/dynamic({ ssr: true })`로 분리.
- SEO/LCP 유지 (SSR 활성)
- 리포트 페이지 첫 방문 시에만 recharts 청크 로드

### G-90 — 리포트 진입점
**문제**: `/admin/campaigns/[id]/report`가 URL 직접 입력해야 접근 가능.
**해결**: `CampaignList` 액션 버튼에 "📊 리포트" 추가.
- `draft` 상태만 disabled — active도 실시간 지표 확인 유용
- router.push로 이동

### G-88 — 감사 이메일 실패 재시도 cron
**문제**: `campaign_closed_thanks`가 SMTP 실패 시 `status='failed'` 로그만 남기고 자동 재시도 없음.
**해결**: `/api/cron/retry-failed-emails` 신규 (일 1회).
- 7~30일 사이 failed + 같은 조합에 sent 기록 없는 케이스 재시도
- 중복 조합 dedupe, 캠페인 `closed` 상태 검증
- 30일 이상은 포기 (수동 개입 필요)
- 7일 이내 failed는 아직 재시도 안 함 (initial failure → 관리자 확인 시간 제공)

---

## vercel.json 권장 추가

```json
{
  "crons": [
    { "path": "/api/cron/notify-churn-risk", "schedule": "0 0 * * 1" },
    { "path": "/api/cron/auto-close-campaigns", "schedule": "0 0 * * *" },
    { "path": "/api/cron/retry-failed-emails", "schedule": "0 1 * * *" },
    { "path": "/api/cron/cancel-stale-payments", "schedule": "*/30 * * * *" }
  ]
}
```

---

## 남은 리스크 (2건)

### 중간

#### G-94. Lighthouse 측정 미수행
- Phase A~D 랜딩 빌더 + financials + 리포트까지 recharts/next/dynamic 최적화 완료
- 실측 LCP/CLS/INP 숫자 확인 안 됨
- **해결**: `npx lighthouse http://localhost:3000/?draft=1 --output=json` 또는 Vercel Speed Insights 연동
- **우선순위**: 중간 (수치 기반 판단 필요)

#### G-95. jest-axe 자동 accessibility 테스트 미구축
- 스펙 §10.4에 명시됐으나 스프린트 중 구현 안 됨
- **해결**: `@axe-core/react` 또는 `jest-axe` 도입 후 주요 섹션/variant 스모크 a11y 테스트
- **우선순위**: 중간 (점진적 도입)

### 낮음

#### G-96. retry-failed-emails의 "7일 이내 대기" 정책 문서 부재
- 코드 주석에만 있고 관리자는 "왜 실패한 이메일이 바로 재전송 안 되는지" 알 수 없음
- **해결**: `/admin/stats` 또는 `/admin/settings`에 "최근 실패한 이메일" 위젯 추가 + "수동 재전송" 버튼
- **우선순위**: 낮음 (관리자 문의 빈도에 따라)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **97 passed** (변경 없음) |
| 신규 cron | 1 (`retry-failed-emails`) |
| 최적화된 기존 cron | 1 (auto-close N+1) |
| dynamic import 적용 | 1 (리포트 차트) |
| React cache 적용 | 1 (org settings) |
| UI 개선 | 1 (캠페인 목록 리포트 버튼) |
| 빌드 | 성공 |

**Phase 4-D 완료. 다음 단계 후보는 G-78 스테이징 회귀 검증(배포 직전) 또는 Phase 4-C engagement(후원자 초대/공유).**

---

## 남은 주요 미처리 GAP (프로덕션 배포 전 고려)

- **G-78** 스테이징 v1 페이지 회귀 검증 (실제 배포 환경 필요)
- **G-94** Lighthouse 실측 (CI 또는 수동)
- **G-95** a11y 자동 테스트 도입
- **G-92** 수신 이메일 변경 링크 (UI 완성도)
- **G-93** settings 변경 감사 로그 (다중 관리자 환경)
- **G-96** 실패 이메일 수동 재전송 UI
