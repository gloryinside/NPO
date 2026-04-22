# GAP 분석 — 알림/감사 이메일 체계화 (2026-04-22, Phase 4-A)

Phase 4 첫 단계. 자동화 이메일의 중복 방지 + 후원자 감사 이메일 + 캠페인 종료 리포트 페이지.

---

## 구현 개요

### 1. 데이터 인프라

**신규 마이그레이션**: `20260422000001_email_notifications_log.sql`
- 테이블: `email_notifications_log (org_id, kind, recipient_email, ref_id, status, error, sent_at)`
- **부분 UNIQUE 인덱스**: `(kind, ref_id, recipient_email) WHERE ref_id IS NOT NULL AND status='sent'`
  - 캠페인 감사 이메일(`ref_id=campaign_id`)이 동일 수신자에게 중복 INSERT 되지 않도록 DB 레벨 보장
- RLS: admin만 조회 가능 (cron은 service_role로 bypass)

**공용 lib**: `src/lib/email/notification-log.ts`
- `wasSentWithin(orgId, kind, days)` — 주간 알림 skip 조건
- `logNotification({orgId, kind, recipientEmail, refId, status, error})` — 발송 로그 기록, UNIQUE 위반(23505) 시 `{duplicate:true}` 반환
- `alreadySentCampaignThanks(campaignId, email)` — 조회형 헬퍼 (보조용)

### 2. G-85 해소 — notify-churn-risk 중복 방지

**변경**: `src/app/api/cron/notify-churn-risk/route.ts`
- 각 org 루프에서 **발송 전 `wasSentWithin(org.id, 'churn_risk_weekly', 7)`** 체크 → 지난 7일 내 기록 있으면 skip
- 발송 후 `logNotification` 호출로 성공/실패 모두 기록
- cron 스케줄(주 1회)이 정상이면 실질적 변화 없음, 수동 재실행 시 중복 방지

**결과 스키마에 `error: 'skipped_recent'` 추가** — 관측 가능

### 3. G-86 해소 — auto-close-campaigns 감사 이메일

**변경**: `src/app/api/cron/auto-close-campaigns/route.ts`
- 기존: 캠페인 `status = 'closed'`로만 전환
- 추가: **목표 달성 마감 캠페인만** `sendCampaignThanksEmails()` 호출
  - 기간 경과 마감은 축하 맥락이 아니므로 제외
- 각 후원자(paid 결제, 이메일 있음)별:
  1. 개인 누적 후원액 집계
  2. HTML 이메일 발송 (🎉 + 개인 후원액 + 목표 달성률)
  3. `logNotification` 호출 — UNIQUE 인덱스로 중복 INSERT 방지
- 응답에 `thanksEmailsSent`, `thanksEmailsSkipped` 추가

### 4. 캠페인 종료 리포트 페이지

**신규**: `/admin/campaigns/[id]/report`
- `tenant isolation` 체크: 다른 기관 캠페인 접근 시 404
- 지표 4카드: 총 모금 / 목표 달성률 / 결제 건수 / 고유 후원자
- 일별 + 누적 LineChart (recharts)
- 재참여(recurring) vs 신규(firstTime) 후원자 split + 프로그레스바
- 상위 후원자 Top 10 표
- 관련 액션: 캠페인 편집, 전체 통계 이동

**lib**: `src/lib/campaigns/report.ts` + 테스트 4건 (빈 payments, 기본 집계, 목표 없음, campaign 없음)

**retention 정의**: 해당 캠페인 외 다른 캠페인에도 paid 결제 이력이 있으면 recurring, 그렇지 않으면 firstTime.

---

## 남은 리스크 (3건)

### 중간

#### G-88. 캠페인 감사 이메일 발송 실패 시 재시도 없음
- 현재 SMTP 실패는 `status='failed'`로 로그만 남김
- UNIQUE 인덱스는 `status='sent'`에만 적용 → failed 기록이 있으면 재시도 가능하지만, 자동 재시도 cron은 없음
- **해결**: `notify-churn-risk` 스케줄과 별도로 "발송 실패 재시도" cron (일 1회, 최근 7일 failed 찾아서 재발송)
- **우선순위**: 중간 (감사 이메일은 단발성이라 상대적으로 덜 긴급)

#### G-89. 리포트 페이지 recharts 번들
- `/admin/campaigns/[id]/report`가 `ReportDailyChart`를 직접 import → 리포트를 안 보는 admin 페이지에도 recharts 포함될 가능성
- `/admin/stats`는 이미 recharts 사용 중이라 공통 chunk에 이미 있을 수 있음 — 실측 필요
- **해결**: `next/dynamic`으로 분리 고려. 단 admin 영역은 SEO 영향 없어 ssr:false도 OK
- **우선순위**: 중간 (측정 기반 판단)

### 낮음

#### G-90. 캠페인 종료 리포트 진입점 부재
- 현재 `/admin/campaigns/[id]/report`는 URL 직접 입력해야 접근 가능
- **해결**: `/admin/campaigns` 목록에서 `status='closed'` 캠페인 옆에 "리포트 →" 링크, 또는 `/admin/campaigns/[id]/edit` 상단에 "종료 리포트 보기" 버튼
- **우선순위**: 낮음 (직접 링크 후에도 동작)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **90 passed** (+4 campaigns/report) |
| 신규 마이그레이션 | 1 (`email_notifications_log`) |
| 신규 lib | 2 (notification-log, campaigns/report) |
| 신규 페이지 | 1 (`/admin/campaigns/[id]/report`) |
| 수정 cron | 2 (notify-churn-risk, auto-close-campaigns) |
| 빌드 | 성공 |

**Phase 4-A 완료. 다음 단계는 4-B (관리자 설정 UI) 또는 4-D (성능/신뢰성).**

---

## 다음 단계 후보 (Phase 4-B ~ 4-D)

1. **Phase 4-B — 관리자 설정 UI**
   - `orgs.settings` JSONB 컬럼 추가 마이그레이션
   - `/admin/settings`에 "주간 알림 수신" 토글 + "임팩트 단가" (G-82) 등
   - `notify-churn-risk`에서 `settings.weekly_alert_enabled` 체크

2. **Phase 4-C — 후원자 engagement** (보류 가능)
   - 후원자 초대/공유 프로그램
   - 정기후원 업그레이드 플로우

3. **Phase 4-D — 성능/신뢰성**
   - G-87 auto-close N+1 쿼리 최적화
   - G-89 리포트 recharts dynamic import
   - Lighthouse 측정, a11y 자동 테스트
   - G-78 스테이징 v1 회귀 검증
