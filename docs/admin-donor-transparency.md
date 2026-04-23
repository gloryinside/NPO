# Admin / Donor 데이터 가시성 매트릭스 (G-D43)

**최종 업데이트**: 2026-04-23
**범위**: 후원자 포털(`/donor`) vs. 관리자 콘솔(`/admin`) — 같은 member 레코드에 대해 각 주체가 볼 수 있는 필드

본 문서의 목적:
1. 후원자에게 "내 데이터 중 관리자에게만 보이는 것"을 투명하게 공개
2. 정책 변경 시 양쪽 UI 동기화 기준점
3. 신규 기능 설계 시 기본값 결정에 활용

---

## 1. Member 프로필

| 필드 | Donor 가시 | Donor 수정 | Admin 가시 | Admin 수정 | 비고 |
|---|---|---|---|---|---|
| `id`, `member_code` | ✓ | ✗ | ✓ | ✗ | 시스템 식별자 |
| `name` | ✓ | ✓ | ✓ | ✓ | 프로필 편집 |
| `email` | ✓ | ✗ | ✓ | ✓ | Donor는 인증 연결이라 직접 수정 불가 |
| `phone` | ✓ | ✓ | ✓ | ✓ | 감사 로그에 마스킹 기록 |
| `birth_date` | ✓ | ✓ | ✓ | ✓ | — |
| `id_number_encrypted` | ✗ | ✗ | 일부 | ✓ | 영수증 발급 시 관리자만 복호화 가능 |
| `join_path` | ✗ | ✗ | ✓ | ✓ | 유입 경로(내부 통계) |
| `note` | ✗ | ✗ | ✓ | ✓ | **관리자 전용 메모** — 상담 이력 등 |
| `status` (`active/inactive/deceased/withdrawn`) | 간접(배너) | ✗ | ✓ | ✓ | Donor는 명시적으로 안 보여짐 |
| `member_type` | ✗ | ✗ | ✓ | ✓ | 일반/VIP 등 내부 분류 |
| `notification_prefs` | ✓ | ✓ | ✓ | ✗ | Donor만 수정 |
| `theme_preference` | ✓ | ✓ | ✗ | ✗ | Donor만 사용 |
| `referrer_id` | 간접(내 추천자 정보는 미노출) | ✗ | ✓ | ✓ | 누가 나를 초대했는지 Donor는 안 보임 |
| `deleted_at` | ✗ | 간접(삭제 요청) | ✓ | ✗ | Soft-delete 표식 |

**Donor에게만 제공**: `theme_preference`, `notification_prefs` 토글.
**Admin에게만 제공**: `note`(메모), `join_path`, `member_type`, `referrer_id`, `id_number_encrypted`.

---

## 2. 약정 (Promise)

| 필드 | Donor | Admin | 비고 |
|---|---|---|---|
| `amount`, `pay_day`, `status` | ✓ | ✓ | — |
| `promise_code`, `started_at`, `ended_at` | ✓ | ✓ | — |
| `toss_billing_key`, `customer_key` | ✗ | 일부 | Admin에서도 키 원문 노출 안 함(마스킹 표시만) |
| `amount_change_history` (감사 이력) | ✓ (내 이력) | ✓ (모든 회원) | Donor도 다이얼로그에서 조회 |
| `failure_count`, `retry_count` | ✗ | ✓ | 내부 운영 지표 |

---

## 3. 납입 (Payment)

| 필드 | Donor | Admin | 비고 |
|---|---|---|---|
| `amount`, `pay_date`, `pay_status`, `pay_method` | ✓ | ✓ | — |
| `fail_reason` | 간접(재시도 실패 alert) | ✓ | Donor에는 사유 요약만 |
| `pg_tx_id`, `toss_payment_key` | ✗ | ✓ | PG사 대조용 |
| `note` | ✗ | ✓ | 관리자 처리 메모 |
| `cancel_reason`, `cancelled_at` | 간접 | ✓ | — |

---

## 4. 영수증 (Receipt)

| 필드 | Donor | Admin | 비고 |
|---|---|---|---|
| `receipt_code`, `year`, `total_amount`, `issued_at` | ✓ | ✓ | — |
| `pdf_url` (스토리지 경로) | 간접(서명 URL 통해 다운로드만) | ✓ | Donor 직접 URL 접근 불가 |
| `reissue_logs` | ✗ | ✓ | 재발급 이력은 관리자만 |

---

## 5. 응원 메시지 (Cheer)

| 필드 | Donor | Admin | 비고 |
|---|---|---|---|
| 본인이 작성한 메시지 + 상태 | ✓ | ✓ | — |
| 숨김 처리(`hidden_reason`) | 간접("관리자 숨김" 라벨만) | ✓ 전체 사유 | Donor는 어떤 이유로 숨김됐는지 세부 못 봄 |
| 다른 후원자 메시지(게시) | ✓(공개 목록) | ✓ | — |

---

## 6. 감사 로그 (Audit Log — G-D25)

| 이벤트 | Donor 열람 | Admin 열람 |
|---|---|---|
| `profile_update` (본인 변경) | (미구현 — 추후 UI 계획) | ✓ |
| `password_change` | (미구현) | ✓ |
| `account_delete` | 이메일 통지만 | ✓ |
| 관리자 변경 이력 | ✗ | ✓ (별도 admin_audit_log) |

`member_audit_log` 테이블은 RLS로 본인 기록만 SELECT 가능 (`member.supabase_uid = auth.uid()`).
현재는 조회 UI 미제공 — 향후 **G-D46: 내 계정 활동 이력 조회**로 추가 예정.

---

## 7. 투명성 원칙

1. **Donor는 본인 민감정보(PII)를 수정할 수 있다** — 예외: 이메일(인증과 연결), 주민번호(법정 절차 필요)
2. **Admin 메모/태그는 절대 Donor에게 노출되지 않는다** — 내부 운영 판단의 자유 보장
3. **모든 Donor PII 변경은 감사 로그에 기록된다** — 폰·생년월일은 마스킹 후 저장
4. **PG 비밀키·빌링키 원문은 DB에도 마스킹**되어 운영팀조차 Toss 대시보드에서만 확인 가능
5. **Account 삭제는 soft-delete + 회계 이력 보존** — 완전 삭제(hard-delete)는 별도 관리자 워크플로 필요

---

## 8. 향후 개선 대기 (관련 GAP)

| ID | 내용 |
|---|---|
| G-D46 | "내 활동 이력" 페이지 (Donor가 member_audit_log 조회) |
| G-D47 | Admin 메모의 공개 정책 토글 (선택적으로 Donor 노출) |
| G-D48 | 데이터 내보내기 (GDPR Article 15 스타일 통합 export) |
