# GAP 분석 — Phase 5-A 임팩트 페이지 고도화 (2026-04-22)

Phase 3의 `/donor/impact` 기본 페이지를 3개 축으로 확장:
**월별 히트맵 + 연간 리포트 PDF + 소셜 공유 카드**

---

## 구현 개요

### 1. 월별 히트맵

**변경**: `src/lib/donor/impact.ts`
- `DonorImpact.byMonth: Array<{ month, amount, count }>` 추가 (YYYY-MM 키)
- `getDonorImpact` 내부 Map 하나 추가, `pay_date` 파싱 시 연도와 함께 월 키 계산
- 테스트 +1 (`byMonth` 집계 검증)

**신규 컴포넌트**: `ImpactMonthlyHeatmap`
- 행 = 연도, 열 = 1~12월 (12칸)
- 색상 4단계: 0 / low (p33) / mid (p66) / high — 분위수 기반
- hover 시 tooltip (title 속성)
- 범례: 적음 → 많음 4개 스와치

### 2. 연간 리포트 PDF

**신규 lib**: `src/lib/donor/impact-pdf.ts`
- 기존 `receipt/pdf.ts`의 pdfmake 셋업 재활용
- NotoSansKR 폰트 경로 동일 사용
- 문서 구조:
  - 제목 + 연도·기관명
  - 3대 지표 박스 (누적/건수/개월)
  - 감사 메시지
  - 참여 캠페인 Top 5 테이블
  - 연도별 후원 테이블
  - 하단 "세법상 영수증 아님" 안내 (작은 이탤릭)

**신규 API**: `GET /api/donor/impact/pdf?year=YYYY`
- `getDonorSession` 인증
- `rateLimit('impact:pdf:${memberId}', 5, 60_000)` — 분당 5회
- `year` 생략 → 전체 기간, 숫자 → 해당 연도 서브셋
- 유효성 검사 (`2000 ≤ year ≤ 2100`)
- `Content-Disposition: attachment` + UTF-8 파일명
- 결제 0건이면 400

**연도 필터링 한계**:
- byYear/byMonth는 연도별로 깔끔하지만 **byCampaign은 원본 DB 재쿼리 없이는 연도 분리 불가** → 전체 기간 유지
- PDF 문구에 "상위 5 캠페인"으로 라벨링해 혼동 최소화
- 완전한 연도별 campaigns 집계는 차기(**G-97**)로 분리

### 3. 소셜 공유 카드 (OG 이미지)

**신규 API**: `GET /api/donor/impact/og`
- `next/og`의 `ImageResponse` 사용, 1200×630 (OG 표준)
- 배경: `linear-gradient(135deg, #1a3a5c → #7c3aed)` (accent 토큰)
- 콘텐츠: 이름 마스킹(김○○) + 총액 + 건수/개월/캠페인수 3칸 + 기관명
- **프라이버시**: 이름은 첫 글자만 + 나머지 `○` 치환
- 인증 필요 (세션) — 타인이 URL로 남의 이미지 접근 불가

**신규 컴포넌트**: `ImpactShareActions`
- PDF 다운로드: 연도 선택 드롭다운 + 버튼 (fetch + blob 다운로드)
- 공유 카드: 미리보기 버튼 + "링크 복사" (navigator.clipboard)
- toast 피드백

### 4. 페이지 통합

`/donor/impact`:
- 기존 섹션 유지 + "월별 히트맵" / "리포트·공유" 2개 섹션 추가
- 히트맵은 `byMonth.length > 0`일 때만
- 공유 액션은 `availableYears={impact.byYear.map(y => y.year).reverse()}` 로 드롭다운 옵션 전달

---

## 남은 리스크 (4건)

### 중간

#### G-97. PDF 연도 필터링의 byCampaign 불완전
- `year=2024` 다운로드해도 캠페인 Top 5는 전체 기간 기준
- **해결**: `getDonorImpact(year?)` 오버로드 또는 별도 `getDonorImpactForYear` — 쿼리 레벨에서 `pay_date` between 조건
- **우선순위**: 중간 (연도별 리포트 정확성)

#### G-98. OG 이미지 생성 성능/캐시
- 매 요청마다 DB 쿼리 + ImageResponse 렌더
- SNS 크롤러가 같은 URL을 여러 번 호출할 수 있어 응답 캐시 필요
- **해결**: `Cache-Control: private, max-age=300` + 결제 기록 변경 시 `revalidateTag` (세부 설계 별도)
- **우선순위**: 중간 (실제 공유 빈도에 따라)

### 낮음

#### G-99. PDF 폰트 미설치 시 fallback UX
- NotoSansKR-*.ttf 없으면 에러 throw → 사용자는 "pdf_failed"만 봄
- **해결**: API에서 폰트 미설치 감지 시 400 + 명확한 관리자 안내 메시지
- **우선순위**: 낮음 (설치 자동화가 이미 postinstall에 있음)

#### G-100. OG 이미지 한글 폰트 로딩
- `next/og` 기본 폰트는 한글 지원 제한적일 수 있음
- 일부 환경에서 한글이 `�` 박스로 표시될 가능성
- **해결**: `ImageResponse`의 `fonts` 옵션으로 NotoSansKR 커스텀 폰트 로딩
- **우선순위**: 낮음 (실측 후 필요 시)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **104 passed** (+1 byMonth) |
| 신규 API | 2 (`impact/pdf`, `impact/og`) |
| 신규 컴포넌트 | 2 (히트맵 + 공유 액션) |
| 신규 lib | 1 (`impact-pdf.ts`) |
| 빌드 | 성공 |

---

## 다음 Phase 5 후보

Phase 5 원 계획(4개 하위 항목 중 1번 완료):
1. ✅ 임팩트 페이지 고도화 (이번)
2. 초대/공유 프로그램 — 추천인 코드 + 성공 뱃지
3. 정기후원 업그레이드/다운그레이드 플로우
4. 후원자 커뮤니티 (응원 메시지 월)

**다음 추천: 2번 초대/공유 프로그램** — 임팩트 공유 카드와 자연스럽게 이어지고, 기관 모금 성장에 직접적 효과.
