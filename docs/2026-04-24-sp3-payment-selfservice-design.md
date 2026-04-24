# SP-3: 결제 셀프서비스 완결 (2026-04-24)

## 목적

Tier 9~13의 dunning/chargeback 백엔드가 탄탄한데, 사용자가 스스로 해결할 수 있는 UX 경로가 부족. 프론트 셀프서비스 완성으로 CS 티켓 감소.

---

## 현황 GAP

| GAP | 내용 | 위치 |
|-----|------|------|
| G5 | PG 에러코드 → 친화적 메시지 매핑 없음 | `src/lib/payments/toss-billing.ts:73` |
| G6 | `confirm()` 브라우저 다이얼로그 — 커스텀 모달 미연결 | `promises/page.tsx:116`, `cancel-confirm-modal.tsx` 존재 |
| G7 | pledges/promises 역할 중복 | `api/donor/pledges/[id]/cancel` |
| G8 | 결제일(pay_day) 변경 기능 없음 | API·UI 없음 |

---

## 설계 결정

### B5: PG 실패 코드 → 사용자 메시지 매핑

Toss Payments 에러코드를 한국어 친화 메시지 + 복구 가이드로 변환.

```typescript
// src/lib/payments/pg-error-messages.ts (신규)
const TOSS_ERROR_MAP: Record<string, { message: string; action: string }> = {
  CARD_EXPIRATION:           { message: '카드 유효기간이 만료되었습니다.', action: '새 카드로 교체' },
  EXCEED_MAX_DAILY_AMOUNT:   { message: '카드 일일 한도를 초과했습니다.', action: '내일 자동 재시도' },
  INVALID_STOPPED_CARD:      { message: '사용 정지된 카드입니다.', action: '카드사에 문의 후 교체' },
  INSUFFICIENT_BALANCE:      { message: '잔액이 부족합니다.', action: '잔액 확인 후 재시도' },
  REJECT_CARD_COMPANY:       { message: '카드사에서 승인을 거부했습니다.', action: '카드사 문의' },
  // ... Toss 공식 에러코드 전수
}

export function getPgErrorMessage(code: string) {
  return TOSS_ERROR_MAP[code] ?? { message: `결제 처리 중 오류가 발생했습니다.`, action: '고객센터 문의' }
}
```

**적용 위치**:
- `src/app/(donor)/donor/payments/page.tsx` — 납입 목록에서 `fail_reason` 코드가 있으면 매핑 메시지 + 복구 버튼 표시
- `src/components/donor/payment-retry-button.tsx` — retry 실패 시 에러 메시지에 적용
- `src/lib/payments/retry-charge.ts:161` — `fail_reason` 저장 시 코드 그대로 저장 (매핑은 UI 레이어에서만)

### B6: 약정 일시중지(Pause)

`promises.status = 'suspended'`는 이미 스키마와 API에 존재. `promises/page.tsx`에서 suspend/resume 액션도 구현됨. **추가 구현 없음.**

단, **확인 필요**: `promises/page.tsx:116`의 `confirm()` 브라우저 다이얼로그가 Pause에도 사용되는지 검토 → G6와 함께 처리.

### G6: `confirm()` → 커스텀 모달 교체

`cancel-confirm-modal.tsx`가 이미 존재하지만 `promises/page.tsx`에 미연결.

```typescript
// src/app/(donor)/donor/promises/page.tsx 수정
// 기존: if (!confirm('정말 해지하시겠습니까?')) return
// 변경: CancelConfirmModal state 관리로 교체

const [confirmTarget, setConfirmTarget] = useState<{
  id: string; action: 'cancel' | 'suspend'; title: string
} | null>(null)
```

`CancelConfirmModal`에 `action` prop 추가하여 해지/일시중지 문구 분기.

### B7: 금액 변경 — 현황 확인

`promises/page.tsx`에 `changeAmount` 액션이 이미 있음. `/api/donor/promises/[id]` PATCH에서 `changeAmount` 처리하고 `promise_amount_changes`에 `actor='member'`로 기록.

**추가 구현**: UI에서 변경 사유 입력 필드 추가 (`reason` 텍스트). 현재 사유 없이 금액만 전송.

```typescript
// promises/page.tsx changeAmount dialog에 reason textarea 추가
<textarea
  placeholder="변경 사유 (선택)"
  value={reason}
  onChange={e => setReason(e.target.value)}
  className="..."
/>
```

### G7: pledges/promises 역할 정리

`pledges` = 후원 약정(= `promises`의 별칭). `/api/donor/pledges/[id]/cancel`은 `promises` 테이블을 조작. 역할 중복.

**결정**: `/api/donor/pledges/` 라우트를 `/api/donor/promises/`로 리다이렉트 처리 후 제거. `PledgeCancelButton`이 `pledges/[id]/cancel`을 호출하고 있으므로 호출 경로를 `promises/[id]` (PATCH status=cancelled)로 변경.

### B8: 결제일(pay_day) 변경

`promises.pay_day` 컬럼 존재. 현재 변경 API/UI 없음.

**API**: `/api/donor/promises/[id]` PATCH에 `pay_day` 필드 추가 (1~28일 제한, 29~31일 제외하여 월말 차이 문제 방지).

**UI**: `promises/page.tsx` 약정 카드에 "결제일 변경" 드롭다운 추가 (금액 변경 버튼 옆).

```typescript
// src/app/api/donor/promises/[id]/route.ts PATCH 핸들러 수정
if (body.pay_day !== undefined) {
  const day = parseInt(body.pay_day)
  if (day < 1 || day > 28) return error('결제일은 1~28일 사이여야 합니다.')
  await supabase.from('promises').update({ pay_day: day }).eq('id', id)
  // promise_amount_changes와 별도 audit log (pay_day_changes 또는 기존 테이블 활용 검토)
}
```

**Audit**: `promise_amount_changes`는 금액 변경 전용 스키마. `pay_day` 변경은 `member_audit_log`의 `action='pay_day_changed'` 이벤트로 기록.

---

## 데이터 계층

### 마이그레이션

마이그레이션 없음. 기존 스키마 활용.

단, `/api/donor/promises/[id]` PATCH 핸들러에서 `pay_day` 유효성 검사 + `member_audit_log` 기록 추가.

---

## 컴포넌트 계층

### 신규

- `src/lib/payments/pg-error-messages.ts` — Toss 에러코드 매핑 테이블

### 수정

- `src/app/(donor)/donor/promises/page.tsx` — G6 모달 교체, B8 결제일 드롭다운, B7 API 경로 변경
- `src/app/(donor)/donor/payments/page.tsx` — B5 실패 사유 메시지 표시
- `src/components/donor/payment-retry-button.tsx` — B5 에러 메시지 적용
- `src/components/donor/cancel-confirm-modal.tsx` — `action` prop 추가 (해지/일시중지 문구 분기)
- `src/app/api/donor/promises/[id]/route.ts` — B8 `pay_day` 변경 처리
- `src/app/api/donor/pledges/[id]/cancel/route.ts` — B7 deprecate (307 리다이렉트 또는 제거)
- `src/components/donor/pledge-cancel-button.tsx` — B7 API 경로 변경

---

## 완료 기준

| 항목 | 기준 |
|------|------|
| 에러 메시지 | 주요 Toss 에러코드 10종 매핑, UI에 친화 메시지 표시 |
| 커스텀 모달 | `confirm()` 완전 제거, `CancelConfirmModal` 동작 |
| 금액 변경 | 사유 입력 포함, `promise_amount_changes` actor=member 기록 |
| 결제일 변경 | 1~28일 제한, audit log 기록 |
| pledges 정리 | `pledge-cancel-button` → promises API 사용 |

---

## 제외 (YAGNI)

- 월별 캘린더 뷰 (B8 원래 후보) — 결제일 변경 UI 드롭다운으로 대체, 캘린더는 복잡도 대비 효용 낮음
- 부분 취소 / 환불 (별도 Phase 7-D-2-b 스펙)
- i18n 적용 (SP-6)

---

## 선행 조건

없음 (SP-1과 병렬 가능).
