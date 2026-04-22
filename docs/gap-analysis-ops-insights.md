# GAP 분석 — Phase 6-A 운영 인사이트 (2026-04-22)

Phase 5에서 쌓인 이력/응원 데이터를 관리자가 실제로 활용하고,
공개 경로에 최소한의 남용 방지를 더하는 단계. 세 축을 한 번에 처리:
**G-105(약정 변경 추이 대시보드) + G-108(공개 GET rate limit) + G-109(비속어 필터 기본형)**.

---

## 구현 개요

### 1. G-108 — 공개 /api/cheer GET rate limit

**변경**: `src/app/api/cheer/route.ts`
- 기존 IP 유틸(`getClientIp`)과 in-memory `rateLimit` 재사용
- 키: `cheer:get:${ip}`, 한도 60회 / 60초
- 429 응답에 `Retry-After` 헤더 포함 — 크롤러/봇이 예의있게 물러날 수 있도록

**한계**: 서버리스 인스턴스 단위 메모리라 다수 warm instance가 동시에 맞으면 실질 한도 = instance_count × 60. 실제 공격성 크롤러에 대한 완전 방어는 Vercel KV/Upstash Redis 기반 공유 스토어가 필요(현 단계에서는 최소 방어선).

### 2. G-109 — 비속어/스팸 간이 필터

**신규 lib**: `src/lib/cheer/profanity.ts` — 테스트 11/11 통과
- 사전 2단계: HARD_WORDS(+2점) / SOFT_WORDS(+1점)
- 스팸 휴리스틱: URL 3개(+1) / 5개(+4) / 같은 문자 10회(+2) / 같은 단어 5회(+1)
- 판정 3단계:
  - `clean` (score 0): 즉시 공개
  - `suspicious` (score 1~3): `published=false`로 저장 → admin 승인 대기
  - `block` (score ≥ 4): 저장 거부(400 `profanity_blocked`)
- 정규화: 공백/구두점 제거 + 소문자 — 띄어쓰기 우회(`씨 발.`)도 포착

**cheer lib 확장**: `createCheerMessage`에 선택 파라미터 `published` 추가
- 생략 시 기본 true(기존 동작 유지)
- API에서 profanity 판정에 따라 false 전달

**API 연결**: `/api/cheer` POST
- profanity.verdict=`block` → 400 `profanity_blocked`
- `suspicious` → 저장은 되지만 `published=false`, 응답에 `pendingReview: true`
- `clean` → 즉시 공개

**프론트**: `CheerForm`에 `pendingReview` 처리
- 성공 후 "응원이 접수되었습니다. 관리자 검토 후 공개됩니다." 문구 표시 (role="status")
- 에러 맵에 `profanity_blocked` 추가

**admin 승인 경로**: 이미 있음 — 대기글은 admin 검수 리스트에서 `published=false`로 보이므로 기존 "숨김 해제" 버튼 재활용하면 published true 전환 경로가 필요. 현재 `setCheerHidden`은 hidden만 토글 — 후속 Phase(6-A 보완) 대상.

### 3. G-105 — 약정 변경 추이 대시보드

**신규 lib**: `src/lib/promises/change-stats.ts` — 테스트 5/5 통과
- `getPromiseChangeStats(supabase, orgId, { sinceDays, topN })`
- 반환: `totalChanges`, `totalUp/Down/Same`, `byMonth[]`(월별 카운트 + avgDelta + totalDeltaUp/Down), `topIncreases/topDecreases`(|delta| 기준 상위 N)
- 현재는 앱 레벨 집계(GROUP BY 없음) — 변경량 소규모 단계 전제. 수만 건 스케일에선 SQL view/materialized view 검토

**신규 컴포넌트**: `src/components/admin/charts/promise-change-chart.tsx`
- recharts stacked BarChart: 증액(positive) / 감액(negative) / 동일(muted)
- 기존 admin 차트 패턴(`monthly-payment-chart`) 톤 맞춤

**신규 페이지**: `/admin/promises/changes`
- `searchParams.days` 30 / 90 / 180 클램프 (기본 180)
- 지표 4카드(총/증액/감액/동일)
- 월별 차트 + 증액 Top 10 / 감액 Top 10 테이블
- 각 행: 후원자명 + 캠페인 + 이전→새 + 변동(컬러) + 일자
- `export const dynamic = 'force-dynamic'` — 실시간성 확보

**사이드바**: "약정 관리" 아래 "약정 변경 추이" 링크 추가

---

## 남은 리스크 (3건)

### 중간

#### G-112. 대기 상태(published=false) 응원 승인 버튼 없음
- profanity.suspicious로 대기된 글은 admin 검수 리스트에서 보이지만, "공개 승인" 토글이 현재 없음
- 숨김과 승인 대기는 의미가 다르므로 `published` 별도 토글이 필요
- **해결**: `CheerModerationList`에 `published` 상태 배지 + "승인" 버튼, admin API에 `published` 필드 PATCH 허용
- **우선순위**: 중간 (대기 글이 쌓이면 즉시 병목)

#### G-113. 공개 /api/cheer IP rate limit의 IPv6 취급
- `getClientIp`는 `x-forwarded-for`를 그대로 반환 — Vercel/프록시 환경에서 IPv6 주소가 통째로 키가 됨
- 같은 /64 대역의 다른 주소로 쉽게 우회 가능
- **해결**: IPv6는 앞 64비트로 마스킹 후 키 생성 (`ip::prefix`)
- **우선순위**: 중간 (실제 공격 관측 시)

### 낮음

#### G-114. 변경 이력 CSV 내보내기 없음
- admin이 회계 담당자에게 넘기려면 기간 CSV가 편리함
- 현재 페이지에서 마우스 드래그 + 복붙 수준
- **해결**: `/admin/promises/changes/export.csv?days=180` — UTF-8 BOM + Excel 호환 CSV
- **우선순위**: 낮음 (요청 기반)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **175 passed** (+11 profanity, +5 change-stats) |
| 신규 lib | 2 (`cheer/profanity.ts`, `promises/change-stats.ts`) |
| 신규 페이지 | 1 (`/admin/promises/changes`) |
| 신규 컴포넌트 | 1 (`promise-change-chart`) |
| 수정 API | 1 (`/api/cheer` — GET IP rate limit + POST profanity 분기) |
| 수정 lib | 1 (`cheer/messages` — `published` 매개변수) |
| 수정 컴포넌트 | 2 (`CheerForm` pendingReview UX, `sidebar` 링크) |
| 빌드 | 성공 |

---

## Phase 6 진행 상황

- ✅ **Phase 6-A 운영 인사이트 (이번)**: G-105 / G-108 / G-109
- ⏳ Phase 6-B 후원자 감사 플로우 확장: G-106(업/다운 감사 이메일) / G-111(donor 본인 응원 관리)
- ⏳ Phase 6-C 공유 성장: G-103(초대 카피에 기관명) / G-98(OG 캐시/폰트)

**다음 추천: 6-A 보완(G-112 published 승인 버튼) + 6-B 감사 이메일 확장** — 대기글 병목 해소와 업그레이드 후원자 감사 체인 연결이 가장 체감 ROI가 큼.
