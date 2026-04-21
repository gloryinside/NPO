# GAP 분석 — Phase 1 후원자/결제 고도화 (2026-04-21)

Phase 1 구현 완료 후 후원자·결제·온보딩 도메인에서 발굴한 신규 GAP 항목.

---

## 높음 (3건)

### G-26. resume 후 billingKey 유효성 미검증

**파일**: `src/app/api/donor/promises/[id]/route.ts`  
**문제**: 약정을 일시중지 → 재개(resume) 해도 `toss_billing_key`가 만료/무효가 됐는지 확인하지 않는다. 다음 월 청구 시 `chargeBillingKey`가 Toss 측 오류로 실패하고 retry 3회 후 자동 suspended 처리된다. 후원자 입장에서 재개했는데 결제가 안 되는 상황이 발생한다.  
**해결**: resume 시 `toss_billing_key`가 null이면 `{ ok: true, billingKeyMissing: true }` 응답 + 프론트에서 카드 재등록 안내. null이 아니면 Toss `/billing/{billingKey}` 조회(GET)로 유효성 확인.  
**우선순위**: 높음 (결제 실패로 직결)

---

### G-27. `/api/donor/receipts/[id]/download` rate limit 없음

**파일**: `src/app/api/donor/receipts/[id]/download/route.ts`  
**문제**: signed URL 재발급 API에 rate limit이 없어 공격자가 루프로 스토리지 signed URL을 무한 생성할 수 있다. Supabase Storage에 부하 + 단기간 다수 URL 유출 위험.  
**해결**: `rateLimit(`receipts:download:${session.member.id}`, 20, 60_000)` 추가. IP 기반이 아니라 member_id 기반으로 인증 후 적용.  
**우선순위**: 높음 (인증된 엔드포인트지만 abuse 가능)

---

### G-28. OTP send — rate limit이 org 단위 아닌 phone 단위로만 적용

**파일**: `src/app/api/auth/otp/send/route.ts`  
**문제**: `otp_codes` 조회 시 `eq('org_id', tenant.id)`를 포함하나, 한 번호가 여러 테넌트에 동시 가입된 경우 각 테넌트에서 독립적으로 발송 가능. 실질적인 문제는 SMS 비용 남용보다 **전화번호 기반 enumerate** 가능성 — 같은 IP에서 다수 번호를 1분 간격으로 시도해 등록 여부를 알 수 있다.  
**해결**: IP 기반 rate limit 추가: `rateLimit(`otp:send:ip:${ip}`, 10, 60_000)` — 분당 10회 초과 시 429. `getClientIp`는 이미 `rate-limit.ts`에 존재.  
**우선순위**: 높음 (enumerate + SMS 비용 남용)

---

## 중간 (4건)

### G-29. member upsert 경합 조건 — phone과 email 모두 있을 때 중복 생성 가능

**파일**: `src/app/api/donations/prepare/route.ts` L187–252  
**문제**: phone → email 순 단순 SELECT로 member를 찾는데, 같은 사용자가 phone 없이 email만 등록된 후 나중에 phone+email로 재접수하면 phone 조회 실패 → email 조회 성공 → 정상 매칭. 그러나 **phone은 있고 email은 달라진 경우** 기존 member에 새 email이 반영되지 않고 phone 매칭 결과만 사용된다. 즉, 이메일 갱신 경로가 없다.  
**해결**: member 조회 성공 시 입력된 email이 기존과 다르면 `update({ email })` 적용 (phone 기반 매칭에만). 또는 의도적으로 갱신 안 함으로 정책 결정 후 코드에 주석 명시.  
**우선순위**: 중간 (데이터 정합성 — 영수증 발송 이메일 오배송)

---

### G-30. 정기후원 billingKey 발급 실패 시 약정이 active로 남음

**파일**: `src/app/api/donations/prepare/route.ts` L349–387  
**문제**: `issueBillingKey` 실패 시 `console.warn` 후 `billingKey = null`인 채로 `promises.insert`가 실행된다. `toss_billing_key = null`인 active 약정이 생기고, 다음 월 `processMonthlyCharges`에서 billingKey 없이 charge를 시도하다 실패한다.  
**해결**: billingKey 발급 실패 시 promise.status를 `'pending_billing'`(또는 `'inactive'`)로 설정하거나, 준비 응답에 `{ billingKeyFailed: true }` 플래그를 포함해 프론트에서 카드 재입력 유도.  
**우선순위**: 중간 (매월 청구 실패로 연결)

---

### G-31. `getDonorSession()` N+1 — 매 API 호출마다 2회 DB 쿼리

**파일**: `src/lib/auth.ts` L45–86  
**문제**: Supabase Auth 세션 확인 + members 조회 두 번이 모든 donor API 호출마다 실행된다. 마이페이지처럼 한 페이지 로드에 여러 fetch가 있으면 중복 세션 검증이 발생한다.  
**해결**: Next.js `cache()` 래핑으로 동일 request 내 memoize. `import { cache } from 'react'`로 `getDonorSession`을 감싸면 같은 요청 트리 안에서 한 번만 실행된다.  
**우선순위**: 중간 (성능 — 페이지 로드 지연)

---

### G-32. `/api/donor/link` — 이미 다른 member에 연결된 supabase_uid 재사용 방어 없음

**파일**: `src/app/api/donor/link/route.ts`  
**문제**: 현재 `supabase_uid = null`인 member만 찾아서 연결한다. 그러나 같은 테넌트에서 이메일이 일치하는 member가 **이미 다른 supabase_uid에 연결**된 경우(예: 계정 재생성 시도) 404를 반환한다. 이 경우 사용자는 "등록된 후원 내역이 없습니다" 오류를 보게 되어 혼란 발생.  
**해결**: 이미 `supabase_uid`가 있는 동일 이메일 member를 찾으면 "이미 다른 계정으로 연결된 이메일입니다. 로그인 페이지로 이동하세요." 메시지를 반환. 무분별한 uid 덮어쓰기는 하지 않는다.  
**우선순위**: 중간 (UX — 사용자 혼란)

---

## 낮음 (3건)

### G-33. Step3 CTA — `completeRedirectUrl` 있을 때 자동이동 중 CTA 노출 안 됨

**파일**: `src/app/donate/wizard/steps/Step3.tsx`  
**문제**: `completeRedirectUrl`이 있으면 CTA 블록 전체(`!settings.completeRedirectUrl`)가 숨겨진다. 자동이동까지 3초 동안 계정 생성 안내를 볼 기회가 없다.  
**해결**: 자동이동 타이머 중에도 CTA를 노출하되, "잠시 후 자동으로 이동합니다" 문구 아래에 작게 표시. 이동 전 가입 링크를 클릭하면 `setTimeout` 취소.  
**우선순위**: 낮음 (전환율 개선)

---

### G-34. 약정 금액 변경 시 다음 달 청구 반영 여부 불명확

**파일**: `src/app/api/donor/promises/[id]/route.ts` L79–107  
**문제**: `promises.amount`를 업데이트해도 이미 당월에 청구 대기 중인 `payments.amount`는 갱신되지 않는다. `processMonthlyCharges`가 `promises.amount`를 직접 참조하는지, 아니면 기존 payment를 재사용하는지에 따라 동작이 달라진다.  
**해결**: `charge-service.ts`에서 청구 금액 참조 경로 확인 후 주석으로 명시. 당월 pending payment가 있으면 amount도 함께 갱신하는 로직 추가 검토.  
**우선순위**: 낮음 (운영 혼란 — 금액 변경 즉시 반영 기대)

---

### G-35. signup-form의 `useSearchParams` — Suspense 경계 밖 오류 가능성

**파일**: `src/components/donor/signup-form.tsx`, `src/app/(donor)/donor/signup/page.tsx`  
**문제**: `useSearchParams()`는 Suspense 경계 없이 사용하면 정적 렌더링 시 경고를 유발한다. 현재 `signup/page.tsx`에 `<Suspense>` 추가했으나 fallback이 `undefined`라 로딩 중 빈 화면이 표시된다.  
**해결**: `<Suspense fallback={null}>` 또는 스켈레톤 UI 추가로 UX 개선.  
**우선순위**: 낮음 (Next.js 경고 + 로딩 UX)

---

## 즉시 조치 필요 (이번 커밋에 포함)

| # | 항목 | 파일 | 난이도 |
| --- | --- | --- | --- |
| G-27 | receipts download rate limit | `download/route.ts` | 낮음 |
| G-28 | OTP send IP rate limit | `otp/send/route.ts` | 낮음 |
| G-35 | Suspense fallback | `signup/page.tsx` | 낮음 |

G-26, G-29~G-32는 다음 스프린트에서 처리.
