# GAP 분석 — Phase 2 후원 결제 플로우 + 랜딩 빌더 디자인 (2026-04-21)

Phase 2 `/donate/success` & `/donate/fail` 구현과 위저드 통합 + 랜딩 빌더 디자인 일관화 후 발굴한 GAP.

---

## 높음 (3건)

### G-36. PayMethodSelector가 간편결제(kakaopay/naverpay/payco)를 선택 가능하게 노출

**파일**: `src/components/public/donation/PayMethodSelector.tsx` + `src/app/donate/wizard/steps/Step2.tsx`  
**문제**: Step2는 Toss v1 SDK 타입 제약으로 `card`와 `virtual`만 실제 결제 호출이 가능하다(`TOSS_METHOD_MAP`). 하지만 PayMethodSelector는 `kakaopay/naverpay/payco/cms` 모두 선택 가능하게 노출하고 있어, 사용자가 간편결제를 고른 후 "다음" 버튼을 누르면 마지막 순간에 `alert('지원하지 않는 결제수단입니다.')`가 뜬다. 결제 직전 이탈 유발.  
**해결**:  
- 단기: Step2 진입 시 `settings.paymentMethods`에서 미지원 메서드 필터링하거나, PayMethodSelector에 `disabled` 플래그 전달.  
- 근본: Toss v2 위젯 도입 or 간편결제 각 provider별 `easyPay` 파라미터 분기 플로우 구현.  
**우선순위**: 높음 (전환율 직결)

---

### G-37. 랜딩 이미지 orphan storage 누적

**파일**: `src/app/api/admin/org/landing/images/route.ts` L9 주석  
**문제**: 섹션 삭제 시 `page_content.sections`에서 이미지 URL이 제거되지만 `campaign-assets` 버킷의 실제 파일은 남는다(orphan). 주석은 "비용이 낮아 허용"이라 하지만 장기적으로 누적되면:  
1. 스토리지 비용 증가  
2. 공개 URL이 유효해서 "삭제됐다"는 기대와 달리 접근 가능 (개인정보/민감 이미지 우려는 낮지만 예컨대 이전 버전 로고가 영구 접근 가능)  
**해결**: `PATCH /landing`에서 이전 `page_content`와 새 `page_content`의 이미지 URL diff 계산 후 제거된 URL에 해당하는 스토리지 객체 delete. 또는 scheduled job으로 page_content/published_content에 참조되지 않는 `<orgId>/landing/**` 객체 일괄 삭제.  
**우선순위**: 높음 (보안 + 비용)

---

### G-38. 랜딩 에디터 — 편집 중 페이지 이탈 시 저장 유실

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx`  
**문제**: 자동저장이 2초 debounce이므로 사용자가 편집 직후 탭 닫기/뒤로가기 시 마지막 변경사항 2초가 서버에 반영되지 않음. 섹션 편집 시트(`LandingSectionSettingsSheet`)에서 입력 후 저장 버튼 안 누르고 닫으면 onSave가 호출되지 않아 더 크게 유실될 수 있음 (단 onSave 호출 없으면 state도 업데이트 안 됨).  
**해결**:  
- `beforeunload` 이벤트에서 `saveStatus !== 'saved'`면 "변경사항이 있습니다" 경고.  
- `<SettingsSheet>` 취소 버튼 클릭 시 변경사항 있으면 확인 프롬프트.  
**우선순위**: 높음 (데이터 유실)

---

## 중간 (5건)

### G-39. PayMethodSelector — `transfer` 메서드 아이콘/라벨 누락

**파일**: `src/components/public/donation/PayMethodSelector.tsx` L9  
**문제**: `METHOD_CONFIG`에 `transfer` 항목이 없어 계좌이체 결제수단이 활성화된 캠페인에서 "💰 transfer"로 fallback 표시된다.  
**해결**: `transfer: { icon: '🏦', label: '계좌이체' }` 추가.  
**우선순위**: 중간 (UI 품질)

---

### G-40. /donate/success — designation/customFields 복원 안 됨

**파일**: `src/app/(public)/donate/success/page.tsx` L79-85  
**문제**: WizardState 재구성 시 `payments.designation`과 `payments.custom_fields`를 조회하지 않는다. 현재 Step3는 이 값을 렌더하지 않으므로 사용자 영향은 없지만, 향후 Step3에서 후원처(지정기부) 표시하려는 시점에 놓침.  
**해결**: select에 `designation, custom_fields` 추가, state 객체에 포함.  
**우선순위**: 중간 (미래 UI 확장 준비)

---

### G-41. LandingRenderer — 섹션 배열 정렬 매 렌더마다 재계산

**파일**: `src/components/landing-builder/LandingRenderer.tsx` L59-61  
**문제**: `sections.filter().sort()`가 매 렌더마다 실행된다. `(public)/page.tsx`는 서버 컴포넌트라 실제 부하는 낮지만, 서버에서 published_content를 꺼낼 때 이미 정렬해 저장해둘 수 있다. 더 중요한 것: **sortOrder가 중복된 경우** `sort`가 안정 정렬이라 삽입 순서대로 나오는데 사용자 의도와 다를 수 있다.  
**해결**: `PATCH /landing`에서 저장 시 sortOrder 재계산(0, 1, 2, ...)하도록 정규화. 또는 sortOrder 중복 체크 후 거부.  
**우선순위**: 중간 (데이터 정합성)

---

### G-42. /donate/fail — cancelDonation 실패 silent

**파일**: `src/app/(public)/donate/fail/page.tsx` L18-22  
**문제**: `cancelDonation` 실패 시 console.error만 하고 UI는 성공처럼 보인다. DB상 pending payment가 영원히 남아 후속 처리 곤란.  
**해결**:  
- 단기: console.error에 payment orderId 명확히 로그.  
- 근본: 주기적 cron으로 pending + 30분 경과한 payment를 cancelled로 전환(이미 결제 대기 세션 expired).  
**우선순위**: 중간 (데이터 정합성)

---

### G-43. 랜딩 publish — 동시 저장 race

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx` L222-231  
**문제**: `handlePublish`에서 in-flight debounce를 `clearTimeout` + 즉시 save하는 순서가 있으나, 만약 이전 debounce save가 이미 fetch 단계에 들어간 상태에서 publish를 누르면:  
1. publish의 save PATCH가 먼저 완료 → page_content = 새 내용  
2. 이전 debounce save PATCH가 늦게 완료 → page_content = 이전 내용  
3. publish가 page_content 스냅샷 → 이전 내용으로 published_content 덮어쓰기  

동시 편집 가능성이 낮고 단일 사용자 워크플로우라 발생 가능성은 낮지만 가능.  
**해결**: publish 시 클라이언트가 `sections` 상태를 publish 요청 body에 직접 포함하고, 서버가 `page_content` 업데이트 + published_content 복사를 트랜잭션으로 처리.  
**우선순위**: 중간 (edge case)

---

## 낮음 (3건)

### G-44. 에디터 빈 상태 안내가 추상적

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx` L265-270  
**문제**: 빈 상태에서 "아래 버튼으로 첫 섹션을 추가해보세요"라고 안내하는데 초심자 입장에서 추천 구성이 없다. 일반적으로 "히어로 → 캠페인 → CTA" 같은 템플릿이 필요.  
**해결**: 빈 상태 하단에 "추천 템플릿으로 시작하기" 버튼 추가해 hero+campaigns+cta 세트 자동 삽입.  
**우선순위**: 낮음 (온보딩 UX)

---

### G-45. 랜딩 드래그 핸들 접근성

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx` L84-91  
**문제**: 드래그 핸들이 `⠿` 문자로만 표시되고 키보드 조작(화살표 위/아래로 순서 변경) 미지원. `aria-label`은 있지만 스크린리더 사용자가 sortOrder를 변경할 방법이 없다.  
**해결**: dnd-kit의 keyboard sensor 추가 + 위/아래 버튼 별도 노출(현재 드래그만).  
**우선순위**: 낮음 (접근성)

---

### G-46. 관리자 페이지들에 남은 하드코딩 색상

**파일**: 12개 (`stats/page.tsx`, `insight-card.tsx`, `receipts/page.tsx`, `unpaid/page.tsx`, `nts-export-panel.tsx`, 도너 로그인/가입 폼 일부 등)  
**문제**: `bg-red-500/10`, `text-green-500`, `bg-blue-500/40` 같은 직접 Tailwind 색상 유틸이 상태 표시/에러 UI에 남아있다. 랜딩 빌더와 달리 구조적 문제는 아니지만 일관된 디자인 시스템을 위해 `var(--positive)`, `var(--negative)`, `var(--warning)`로 교체 필요.  
**해결**: 한 번에 몰아 처리하기보다 해당 페이지 수정할 때 점진적으로 교체.  
**우선순위**: 낮음 (시각적 일관성)

---

## 즉시 조치 가능 (소규모)

| # | 항목 | 난이도 |
| --- | --- | --- |
| G-36 | PayMethodSelector `disabled` 간편결제 | 낮음 |
| G-39 | transfer 아이콘/라벨 추가 | 매우 낮음 |
| G-40 | designation/customFields 복원 | 낮음 |

### 다음 스프린트

- G-37 (orphan storage 정리) — 새 API 엔드포인트 + 테스트 필요
- G-38 (beforeunload 저장 유실 방지) — 모든 에디터 페이지 공통 패턴으로 추출
- G-41, G-43 (동시성/정합성) — 서버 트랜잭션 설계
