# GAP 분석 — 관리자 자동화 + 임팩트 개선 (2026-04-22)

Phase 3 우선순위 2(관리자 대시보드 강화) + 3 일부(임팩트 품질)를 한 세션에 처리.

---

## 구현 개요

### 관리자 자동화 (cron 2개)

#### 1. `/api/cron/notify-churn-risk` — 이탈 위험 주간 알림
- **스케줄 권장**: `0 0 * * 1` (UTC 월 00:00 = KST 월 09:00)
- **동작**: 모든 tenant 순회 → `fetchChurnRiskMembers`로 이탈 위험 후원자 조회 → ≥ 3명일 때만 기관 `contact_email`로 HTML 이메일 발송
- **발송 내용**: 상위 5명 (이름, 미납 횟수, 합계, 최근 미납일) + "전체 N명" 표시 + 통계 대시보드 CTA
- **스팸 방지**: 이메일 발신 로그 테이블 없이 주 1회 cron 스케줄로 단순화

#### 2. `/api/cron/auto-close-campaigns` — 캠페인 자동 마감
- **스케줄 권장**: `0 0 * * *` (UTC 일 00:00 = KST 09:00)
- **조건 ①**: `ended_at < now()` AND `status = 'active'` → `status = 'closed'`
- **조건 ②**: `goal_amount > 0` AND paid payments 합계 ≥ goal_amount → `status = 'closed'`
- **반환**: `{ closedByDeadline, closedByGoal, deadlineList, goalList }`

#### 공용 라이브러리
- `src/lib/stats/churn-risk.ts` — 기존 `/admin/stats`에 있던 churn risk 로직 분리
- `/admin/stats` 페이지와 cron 모두 동일 함수 사용 → DRY 원칙
- `memberEmail` 필드 추가 (이메일 발송용)

### 임팩트 페이지 품질 (`/donor/impact`)

#### G-82. 임팩트 단가 설정화
- `getImpactUnitAmount()` 헬퍼 추가 — 환경변수 `IMPACT_UNIT_AMOUNT` (기본 100_000) 참조
- 향후 `orgs.settings` JSONB 컬럼 추가 시 이 함수만 교체하면 DB 기반 기관별 설정으로 확장 가능
- UI 라벨도 동적: `지원 추정 (10만원 단위)` 또는 `(5만원 단위)` 등

#### G-83. 캠페인 7+ "기타" 묶기
- `collapseOthers(items, keep=6)` 헬퍼 추가 — 7개 이상 캠페인 시 상위 5 + "기타 (N건)" 1개로 묶음
- 도넛 차트와 순위 리스트 모두 최대 6개 섹션으로 가독성 확보
- 총액은 원본과 동일 (데이터 손실 없음)
- 테스트: 8개 캠페인 입력 → 6개 반환 + 합계 일치 검증

---

## vercel.json 등록 권장

아직 `vercel.json`에 등록 안 함. 프로덕션 배포 시 crons 섹션에 추가 필요:

```json
{
  "crons": [
    { "path": "/api/cron/notify-churn-risk", "schedule": "0 0 * * 1" },
    { "path": "/api/cron/auto-close-campaigns", "schedule": "0 0 * * *" }
  ]
}
```

기존 등록된 crons(billing-reminder, process-payments, retry-billing 등)와 병치.

---

## 남은 리스크 (3건)

### 중간

#### G-85. churn-risk 이메일 발송 로그 부재
- 현재 주 1회 cron만으로 중복 발송 방지
- 수동으로 cron 재실행하면 같은 주에도 또 발송됨
- **해결**: `notifications` 테이블 추가(`kind='churn_risk_weekly'`, `sent_at`) → cron에서 "지난 7일 내 발송 기록 있으면 skip"
- **우선순위**: 중간 (수동 재실행 빈도에 따라)

#### G-86. 캠페인 자동 마감 시 후원자 알림 부재
- `status = 'closed'`로만 전환, 기존 정기 후원자에겐 알림 없음
- 목표 달성 시 "감사 메시지" 발송이 자연스러움
- **해결**: auto-close 내부에서 각 캠페인 기여 후원자 목록 조회 → 감사 이메일 일괄 발송
- **우선순위**: 중간 (후원자 engagement)

### 낮음

#### G-87. auto-close의 N+1 쿼리
- goal 조건 체크 시 각 active 캠페인마다 payments 합계 쿼리 → 캠페인 100개면 100회
- **해결**: Supabase RPC 함수로 `campaign_id별 sum(amount)` 집계, 또는 materialized view
- **우선순위**: 낮음 (캠페인 수 20~30개 수준에선 무시)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | 86 passed |
| 신규 API 라우트 | 2 (cron) + 0 (impact는 페이지) |
| 공용 lib | 2 (churn-risk, impact, impact-unit) |
| 빌드 | 성공 |
| 해소 GAP | G-82, G-83 + 신규 자동화 2건 |

---

## 남은 Phase 3 후보

1. **G-78** 스테이징 v1 회귀 검증 (배포 직전 이행)
2. **G-85/G-86/G-87** — 알림 로그/후원자 감사 이메일/쿼리 최적화
3. **관리자 UI 추가** — `/admin/settings/notifications`에서 주간 알림 수신 여부 토글
4. **캠페인 종료 후 리포트 페이지** — 기관용 (모금 달성 요약 대시보드)

프로덕션 배포 가능 상태 유지. 주요 자동화 흐름 완비.
