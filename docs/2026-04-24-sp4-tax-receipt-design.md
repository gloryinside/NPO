# SP-4: 세무·증빙 편의 (2026-04-24)

## 목적

한국 정기후원자 세무 처리 페인포인트 해소. QR 위변조 검증, 가족 합산 영수증. 홈택스 직접 연계(C9)는 법무 검토 후 별도 트랙.

---

## 현황 GAP

| GAP | 내용 | 위치 |
|-----|------|------|
| G9 | `certificate` 라우트가 SVG 임시 구현 — 법적 효력 불분명 | `/api/donor/certificate/route.ts` |
| G10 | `members` 테이블에 household 컬럼 없음 — 세대 합산 공제 불가 | `members` 테이블 |
| G11 | 영수증 일괄 zip 다운로드 미확인 | `/api/donor/receipts/export/` |
| G12 | NTS 국세청 연계 API 없음 — 로그 테이블만 존재 | `nts_export_logs` 테이블 |

기존 구현 (재활용):
- `receipts` 테이블: `status(issued/reissued_from/cancelled)`, `superseded_by`, `receipt_code`
- `/api/donor/receipts/[id]/download` — PDF 다운로드
- `/api/donor/receipts/export` — 내보내기 라우트 (포맷 확인 필요)
- `/donor/receipts/tax-summary/page.tsx` — 세액공제 요약 페이지

---

## 설계 결정

### C11: 영수증 QR 위변조 검증 (기존 `certificate` 확장)

현재 `/api/donor/certificate`는 SVG 감사증 다운로드. 이를 **공개 검증 페이지**로 확장.

**구조**:
```
[비공개] /api/donor/certificate/route.ts → SVG 다운로드 (기존 유지)
[공개]   /verify/receipt/[receiptCode]  → 공개 검증 페이지 (신규)
```

공개 검증 페이지는 로그인 불필요. `receipt_code` (영수증 번호)로 조회.

```typescript
// src/app/(public)/verify/receipt/[code]/page.tsx
export default async function ReceiptVerifyPage({ params }: { params: { code: string } }) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('receipts')
    .select('receipt_code, year, total_amount, issued_at, status, member:members(name)')
    .eq('receipt_code', params.code)
    .maybeSingle()

  if (!data) return <NotFound />
  // 이름은 마스킹: "김○○"
  return <VerifyResult receipt={data} />
}
```

**QR 생성**: 영수증 PDF 내부에 `https://[domain]/verify/receipt/[receipt_code]` QR 코드 삽입. 기존 PDF 생성 라우트(`/api/donor/receipts/[id]/download`) 수정.

QR 라이브러리: `qrcode` npm 패키지 (경량, 서버 side 생성).

### C10: 가족 합산 영수증 뷰

**스키마 추가**:

```sql
-- supabase/migrations/20260424XXXXXX_member_household.sql
ALTER TABLE members ADD COLUMN household_id uuid REFERENCES members(id) ON DELETE SET NULL;
-- household_id: 세대주(대표)의 member.id를 참조
-- 세대주 본인은 household_id = NULL (자기 자신이 세대주)
-- 세대원은 household_id = 세대주 member.id
CREATE INDEX idx_members_household_id ON members(household_id) WHERE household_id IS NOT NULL;
```

**API**: `/api/donor/account/household/` (신규)
- `GET` — 내 세대 구성원 목록 + 합산 영수증
- `POST` — 세대원 초대 (이메일/폰 검색 후 연결 요청)
- `DELETE` — 세대 해제

**UI**: `/donor/receipts` 페이지에 "가족 합산 보기" 섹션 추가.

```
📋 내 영수증 (기존)
────────────────
👨‍👩‍👧 가족 합산 영수증 (신규)
  └─ 홍길동 (세대주): 1,200,000원
  └─ 홍길순 (세대원): 800,000원
  └─ 합계: 2,000,000원  [일괄 PDF 다운로드]
```

세대원 연결은 **상호 동의 방식** — 세대주가 초대, 세대원이 수락. `member_audit_log`에 기록.

### G11: 영수증 일괄 ZIP 다운로드

기존 `/api/donor/receipts/export/route.ts` 포맷 확인 후:
- CSV 내보내기면 → ZIP+PDF 추가
- 이미 ZIP이면 → 확인만

**구현**: `archiver` npm 패키지로 연도별 PDF를 ZIP으로 묶어 다운로드.

```typescript
// src/app/api/donor/receipts/export/route.ts 수정 or 신규 서브라우트
// GET /api/donor/receipts/export?format=zip&years=2024,2023
```

### C9: 국세청 홈택스 연계 (별도 트랙 — 이 SP에서 제외)

`nts_export_logs` 테이블이 존재하나 실제 연계 없음. 다음이 필요:
- 국세청 기부금 신고 API 계약 (법인 단위, 법무 검토)
- 주민등록번호 처리 (현재 `rrn_pending_encrypted` 컬럼 기반 — 암복호화 이미 구현)

**결정**: C9는 법무 회신 후 별도 spec으로 분리. 이 SP에서는 **홈택스 연동 준비 상태 UI** 표시만 추가 — "국세청 자동 신고: 준비 중 (출시 예정)" 안내 배너.

---

## 데이터 계층

### 마이그레이션

1. `20260424XXXXXX_member_household.sql` — `members.household_id` 컬럼 + 인덱스
2. `20260424XXXXXX_receipts_qr.sql` — `receipts.qr_url text` 컬럼 추가 (QR 이미지 URL 캐시용, optional)

### 패키지 추가

- `qrcode` — QR 코드 생성 (서버 side)
- `archiver` — ZIP 압축

---

## 컴포넌트 계층

### 신규

- `src/app/(public)/verify/receipt/[code]/page.tsx` — 공개 QR 검증 페이지
- `src/components/receipt/verify-result.tsx` — 검증 결과 표시 (이름 마스킹 포함)
- `src/app/api/donor/account/household/route.ts` — 세대 관리 API
- `src/components/donor/receipts/household-summary.tsx` — 가족 합산 영수증 섹션

### 수정

- `src/app/api/donor/receipts/[id]/download/route.ts` — PDF 내 QR 코드 삽입
- `src/app/api/donor/receipts/export/route.ts` — ZIP 포맷 추가
- `src/app/(donor)/donor/receipts/page.tsx` — 가족 합산 섹션 + 홈택스 준비 안내 배너

---

## 완료 기준

| 항목 | 기준 |
|------|------|
| QR 검증 | `/verify/receipt/[code]` 공개 접근, 이름 마스킹 정상 |
| QR 삽입 | PDF 다운로드 시 QR 코드 포함 |
| 가족 합산 | 세대원 초대 → 수락 → 합산 뷰 표시 |
| 일괄 ZIP | `/api/donor/receipts/export?format=zip` 정상 다운로드 |
| 홈택스 안내 | "준비 중" 배너 표시 |

---

## 보안 고려

- QR 검증 페이지: `receipt_code`로만 조회 → 개인정보 최소 노출 (이름 마스킹, 금액만 표시)
- `household_id` 연결: 상호 동의 방식, 일방적 연결 불가
- ZIP 다운로드: 세션 검증 필수, `org_id + member_id` 스코프

---

## 제외 (YAGNI)

- C9 홈택스 직접 신고 API (법무 트랙)
- 전자 서명 (공동인증서 연동)
- 세무사 API 연동

---

## 선행 조건

없음 (SP-1·3과 병렬 가능). `household_id` 마이그레이션은 `members` 테이블 변경이므로 스테이징 검증 필수.
