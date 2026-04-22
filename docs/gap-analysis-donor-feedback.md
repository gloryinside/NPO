# GAP 분석 — Phase 6-B 감사 플로우 확장 + 본인 응원 관리 (2026-04-22)

Phase 6-A에서 열어둔 GAP을 닫으면서, 후원자가 자기 족적을 스스로 관리할 수 있게 하는 단계.
세 축: **G-112(cheer 승인 버튼) + G-106(업/다운 감사 이메일) + G-111(donor 본인 응원 관리)**.

---

## 구현 개요

### 1. G-112 — cheer 승인(published) 토글

**lib 확장**: `src/lib/cheer/messages.ts`
- `setCheerPublished(supabase, id, published)` 추가 — hidden 토글과 독립

**API 확장**: `PATCH /api/admin/cheer/[id]`
- body에 `hidden` 또는 `published` 둘 다 선택적 허용, 하나라도 없으면 400
- 둘 다 넘어오면 순차 적용 (hidden → published)
- 응답에 적용된 필드만 포함

**UI**: `CheerModerationList`
- "승인 대기" 배지 (published=false AND hidden=false)
- "승인하여 공개" 버튼 → `PATCH { published: true }`
- 기존 "숨김 처리/해제" 버튼과 병렬 배치

### 2. G-106 — 업/다운 감사 이메일

**신규 lib**: `src/lib/promises/amount-change-email.ts` — 5/5 테스트 통과
- `renderAmountChangeEmail('up' | 'down', params)`
- `up`: 제목 "증액 감사", 1.5배 이상이면 "약 N.N배 규모" 문구 자동 삽입
- `down`: 제목 "계속 함께해 주셔서 감사합니다", 이탈 방지 톤
- **HTML 이스케이프 내장** — member/org/campaign 이름의 `<script>` 등 주입 차단 (테스트로 방어 검증)

**notification-log 타입 확장**
- `NotificationKind`에 `amount_change_up`, `amount_change_down` 2종 추가

**API hook**: `/api/donor/promises/[id]` 의 `changeAmount` 성공 직후
- `direction !== 'same'` + `session.user?.email` 있을 때만 발송
- 주 변경은 이미 DB에 반영 끝난 시점에 실행 (fire-and-forget)
- 세 가지 실패 모드 모두 흡수:
  1. `org/campaign` 조회 실패 → try/catch
  2. `sendEmail` 실패 → `logNotification status='failed'` + `error` 저장
  3. `logNotification` insert 실패 → 내부 흡수
- `refId`로 `historyId`를 기록해 나중에 "어느 변경의 감사 메일인가" 추적 가능

**설계 노트**: 기존 `email_notifications_log` 테이블의 partial UNIQUE 인덱스는 `ref_id IS NOT NULL AND status='sent'` 조건이라 amount_change 이벤트도 자동으로 "같은 history에 대한 중복 전송" 방어를 받는다 — 추가 마이그레이션 불필요.

### 3. G-111 — donor 본인 응원 관리

**마이그레이션 없음**: `hidden=true` + `hidden_reason='self_deleted'` 마커로 soft-delete. 스키마 변경 없이 의미 표현.

**lib 확장**: `src/lib/cheer/messages.ts` — 테스트 +3
- `listOwnCheerMessages(supabase, memberId)` — 공개/대기/숨김/삭제 모두 반환 (본인에게는 상태 투명)
- `softDeleteOwnCheer(supabase, id, memberId)` — 4중 방어:
  1. `member_id` 일치 — 타인 글 삭제 불가
  2. `hidden=false` — admin이 이미 다른 사유로 숨긴 건 덮어쓰지 않음 (레이스 안전)
  3. 결과 `data.length === 0`이면 `notFound` 반환 (권한 없음 구분 불가 — 의도적)
  4. `hidden_reason='self_deleted'` 마커로 향후 분석 가능

**신규 API**
- `GET /api/donor/cheer` — 본인 전체 목록
- `DELETE /api/donor/cheer/[id]` — soft-delete

**신규 페이지**: `/donor/cheer` + `OwnCheerList`
- 상태 배지: 공개 중(positive) / 승인 대기(warning) / 관리자 숨김(negative) / 삭제됨(muted)
- hidden=true는 삭제 버튼 숨김 (admin 숨김은 본인이 뒤집을 수 없음 — 이의는 고객센터 경유 설계)
- 삭제 시 confirm dialog → DELETE → router.refresh
- donor-nav에 "내 응원" 링크 추가

---

## 남은 리스크 (3건)

### 중간

#### G-115. 감사 이메일 발송 수신거부(opt-out) 경로 부재
- 현재 업/다운 감사 이메일은 SMTP 설정만 있으면 무조건 발송
- 일부 후원자는 잦은 금액 변경 시 알림을 성가셔할 수 있음
- **해결**: `orgs.settings` 아래 `amount_change_notify: boolean` 또는 members별 `notification_prefs` 컬럼. `/donor/profile`에 토글 추가
- **우선순위**: 중간 (문의 유입 시 우선)

#### G-116. 본인 soft-delete 이후 공개 벽에 남는 캐시 이슈
- 공개 캠페인 페이지는 `revalidate = 60` 으로 ISR — 삭제 후 최대 60초 노출 가능
- donor 관점에선 "삭제했는데 보인다"고 느껴질 수 있음
- **해결**: 삭제 성공 응답에 revalidateTag 또는 공개 페이지가 `force-dynamic`으로 전환 (SEO 영향 트레이드오프 필요)
- **우선순위**: 중간 (UX 혼란 신고 시)

### 낮음

#### G-117. 감사 이메일 수신 시점이 변경 직후 — bursty 느낌
- 하루에 여러 번 업/다운하는 활동적 후원자는 이메일 폭탄 받을 수 있음
- **해결**: 하루 단위 debounce — 같은 promise+direction 이메일이 24시간 내에 있었으면 skip (notification-log 조회)
- **우선순위**: 낮음 (실 빈도 관측 후 판단)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **183 passed** (+8: cheer lib 3신규, email 5) |
| 신규 lib | 1 (`promises/amount-change-email.ts`) |
| 확장 lib | 2 (`cheer/messages.ts`: setCheerPublished/listOwnCheerMessages/softDeleteOwnCheer; `email/notification-log.ts`: Kind 2종 추가) |
| 신규 API | 2 (`GET /api/donor/cheer`, `DELETE /api/donor/cheer/[id]`) |
| 수정 API | 2 (`PATCH /api/admin/cheer/[id]` published 허용, `PATCH /api/donor/promises/[id]` 이메일 hook) |
| 신규 페이지 | 1 (`/donor/cheer`) |
| 신규 컴포넌트 | 1 (`OwnCheerList`) |
| 수정 컴포넌트 | 2 (`CheerModerationList` 승인 버튼, `donor-nav` 링크) |
| 마이그레이션 | 0 (hidden_reason 재활용) |
| 빌드 | 성공 |

---

## Phase 6 진행 상황

- ✅ **Phase 6-A 운영 인사이트**: G-105 / G-108 / G-109
- ✅ **Phase 6-B 감사 플로우 + 본인 관리 (이번)**: G-112 / G-106 / G-111
- ⏳ Phase 6-C 공유 성장: G-103(초대 카피에 기관명) / G-98(OG 캐시/폰트) / G-100(OG 한글 폰트)

**다음 추천: 6-C 공유 성장** — 초대 프로그램(5-B)과 공유 카드(5-A)가 작동하는 지금, 수신자 맥락(기관명) + 이미지 생성 안정성(캐시/폰트)이 전환율에 가장 직접적으로 영향.
