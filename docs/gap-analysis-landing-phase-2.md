# GAP 분석 — 랜딩 Phase 2 financials 섹션 (2026-04-22)

랜딩 Variant 시스템 **Phase 2** — 재무 투명성 섹션 추가 완료 후 검토.
기존 Phase A~D 61 variants → **65 variants** (13 → 14 섹션 타입).

---

## 집계

| 범주 | 이전 | 이번 | 합계 |
|---|---|---|---|
| 섹션 타입 | 13 | +1 (financials) | **14** |
| Variants | 61 | +4 | **65** |
| 썸네일 SVG | 61 | +4 | 65 |
| Variant 폼 | 공용 8개 + 전용 11개 | +4 (financials) | 전용 15개 |
| 테스트 | 79 passed | 79 passed | ✅ |
| `npm run build` | 성공 | 성공 | ✅ |

이번 추가 **2건 bonus** (이전 보류 GAP):
- **G-54** 모바일 비디오 fallback — HeroFullscreenVideo에 매체 쿼리 기반 poster 정적 렌더
- **G-56** GET landing 캐시 헤더 — `Cache-Control: private, max-age=30, must-revalidate`

---

## 추가된 Phase 2 — financials 4 variants

### financials-summary (minimal)
3대 지표 카드: **총 모금 / 집행 / 잔액**. CountUp 애니메이션으로 숫자 강조.
**설계 결정**: 후원자가 가장 먼저 보고 싶은 요약 정보를 단순 카드로. `balance`가 비어 있으면 `totalRaised - totalUsed`로 자동 계산.

### financials-breakdown (bold)
**사용 내역 파이 차트** (recharts `PieChart`). 라벨/금액/색상 커스텀 가능, 자동 fallback 팔레트.
**설계 결정**: "사업비/관리비/모금비" 비율이 NPO 투명성의 핵심 지표. 도넛 차트 + 우측 범례로 데스크톱/모바일 모두 읽기 쉬움.

### financials-timeline (bold)
연도별 모금/사용 **막대 그래프** (recharts `BarChart`). Accent/Info 색상으로 비교.
**설계 결정**: 성장 추이를 한눈에 — 3~5년 데이터만으로도 신뢰 강화.

### financials-transparency (cinematic)
상세 사용 내역 **표 형태** + 증빙 문서 링크 + 감사보고서 PDF CTA.
**설계 결정**: 법적 의무(공익법인회계기준)와 심리적 신뢰 모두 충족. `documentUrl` per 항목 + `reportUrl` 전체 리포트 2단계 구조.

---

## 기술 선택

### recharts 재활용
`package.json`에 이미 설치되어 있어 추가 의존성 없음. `framer-motion`을 제거한 G-74 직후임을 고려하면 신중한 선택이지만, recharts는 관리자 대시보드(`/admin/stats`)에서 이미 사용 중이라 코드 splitting 관점에서 재활용이 유리.

### 색상 토큰 매핑
`breakdown.color`는 hex 입력. 기본 팔레트는 `var(--accent)` / `var(--info)` / `var(--positive)` 등 CSS 변수 hex 값으로 구성 — 다크모드 전환 시에도 일관.

### 데이터 수동 입력 전제
본 스펙 §1에서 밝힌 대로 **`payments` 테이블 자동 집계는 Phase 3+**로 미룸. 이유:
1. NPO 회계는 원칙상 "결산 후 확정값"을 공개해야 해서 실시간 집계가 오히려 부정확
2. `사업비/관리비/모금비` 같은 분류는 수동 태깅이 필요 — 자동화 어려움
3. 관리자가 재무팀과 협의 후 정제된 값을 입력하는 게 실무적

**다만 Phase 3 스펙에서는** 선택적 자동 보조 기능(예: `totalRaised`를 지난 연도 `payments` 합계로 pre-fill)은 고려할 만함.

---

## 남은 리스크 (2건)

### 중간

#### G-79. financials data 자동 집계 부재

**문제**: 관리자가 매년 수동 입력해야 함. 입력 실수 시 전체 투명성이 훼손.
**해결**:
- 에디터에 "지난 연도 `payments` 합계 자동 계산" 버튼 추가 (확정값이 아닌 참고용)
- `totalRaised` 입력 필드 옆에 "자동 계산" 링크 — 클릭 시 `/api/admin/finance/yearly-summary?year=Y` 호출 후 값 주입
- **Phase 3 별도 spec**
**우선순위**: 중간 (관리자 편의)

#### G-80. financials zod 스키마의 `balance` vs `totalRaised - totalUsed` 불일치

**문제**: `balance`는 optional이고 렌더 시 자동 계산되지만, 관리자가 수동 입력한 `balance`가 `totalRaised - totalUsed`와 다른 값이면 렌더는 입력값을 존중. 이 차이가 허용되는지 명시되지 않음.
**해결**:
- 스키마에 `superRefine`으로 `balance === totalRaised - totalUsed` 검증 or
- 에디터 폼에 "계산 불일치" 경고 (차이 > 10% 시)
**우선순위**: 중간 (데이터 정합성)

### 낮음

#### G-81. recharts 번들 영향

**문제**: `PieChart` / `BarChart` + 의존성이 초기 JS에 포함. 다만 기존 `/admin/stats`에서 이미 사용 중이라 증분 영향은 제한적.
**측정**: 아직 안 함. `First Load JS` 증가량 확인 필요.
**해결 후보**: financials variant만 사용하는 페이지에서 `next/dynamic({ ssr: false })`으로 지연 로드 — 단 SEO 영향 고려.
**우선순위**: 낮음 (측정 후 판단)

---

## 이번 세션 누적 성과

| 스프린트 | GAP 해소 | 변경점 |
|---|---|---|
| Phase A~D | G-47~G-72 (26건) | 61 variants + 에셋 경고 + Live preview + framer-motion 경량화 |
| **이번** | G-54, G-56, Phase 2 financials | 65 variants + 모바일 비디오 fallback + 캐시 헤더 |

**총 해소 GAP**: 28건 (전체 Phase 1/2/A/B/C/D/2 누적 기준으로 G-1~G-80 중 해소 대다수)

**상태**: 14개 섹션 타입 × 65 variants, 테스트 79/79 passed, 빌드 성공.

---

## 다음 스프린트 제안

1. **G-79** financials 자동 집계 보조 API — `/api/admin/finance/yearly-summary` + 에디터 "자동 계산" 버튼
2. **G-80** balance 정합성 검증 — 에디터 폼 경고
3. **후원자 개인 임팩트 페이지** (이전 제안 C) — "당신의 10만원이 한 일" 시각화
4. **관리자 대시보드 개선** (이전 제안 D) — 이탈 위험 자동 알림

프로덕션 배포 기준선으로는 **이번 상태로 충분**.
