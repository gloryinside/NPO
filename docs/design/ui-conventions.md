# UI 규칙 — 확인창·알림 (2026-10-17)

브라우저 기본 `alert()` / `confirm()` / `prompt()`는 쓰지 않는다.
디자인·다크 모드를 따르지 않고, 모바일 인앱 브라우저(카카오톡 등)에서 막히거나 화면을 멈춘다.

| 하려는 것 | 쓸 것 |
|---|---|
| 되묻기(예/아니오) | `const confirm = useConfirm()` → `if (!(await confirm({ title, description, confirmText, tone })))` (`@/components/ui/confirm-dialog`, 루트 레이아웃에 Provider 있음) |
| 되돌리기 어려운 동작(삭제·해지·재청구) | 위와 같고 `tone: "danger"`, `confirmText`는 동작 이름("삭제", "해지") |
| 결과 알림 | `toast.success / toast.error / toast` (`sonner`). Toaster는 관리자·후원자 레이아웃과 `src/app/donate/layout.tsx`에 있음 |
| 텍스트 입력 받기 | 그 자리에 작은 입력란(인라인 폼) |
| 화면 안 오류 문구 | `role="alert"` 문단 |

컴포넌트 테스트에서 `useConfirm`을 쓰는 컴포넌트를 그리면 `<ConfirmProvider>`로 감싼다.

# 쉬운 시스템 원칙 (2026-10-17) — 교육 없이 쓰는 비영리 직원 기준

| 대상 | 규칙 | 구현 |
|---|---|---|
| 말 | 메뉴·화면 제목은 쉬운 말(약정→정기후원, 납입→결제, 대사→확인). 모든 메뉴에 한 줄 설명 | `src/lib/admin/nav.ts`의 `label`·`desc` (테스트가 어려운 용어 단독 사용을 막음) |
| 찾기 | 메뉴 이름을 몰라도 "하고 싶은 일"·문장으로 찾기. 못 찾으면 AI에게 물어보기 | ⌘K 메뉴 찾기(`searchNav`: 조사 떼고 낱말 매칭) + `/api/admin/assist`(링크는 메뉴 목록 안에서만) |
| 길 | 지금 위치 표시, 상세에서 목록으로 한 번에 | `AdminBreadcrumb`(메뉴 정의로 자동), 본문 건너뛰기 링크 |
| 시작 | 처음 쓰는 기관은 대시보드 "시작하기" 4단계를 따라 하면 됨 | `GettingStarted` — 필수 단계 끝나면 사라짐 |
| 표 | 행 동작은 늘 보이게, 행은 키보드로도 열림, 열 제목으로 정렬, 낯선 열은 ⓘ 설명, 숫자 자릿수 정렬, 비면 "다음에 할 일" | `DataTable`(`sortValue`, `hint`, `emptyHint`, `emptyAction`, `rowLabel`) |
| 버튼 | 동작 이름 그대로("정기후원 해지"), 진행 중엔 `loading`(두 번 누름 방지), 위험 동작은 채운 빨강 | `Button`의 `loading`, `variant="destructive"` |
| 레이어 | 직접 `fixed inset-0` 만들지 않기 → `Modal`(가운데)·`Sheet`(오른쪽). 포커스 가두기·Esc·스크롤 잠금 기본 | `src/components/ui/layer.tsx` |
| 오류·빈 화면 | 사과·모호한 말 대신 무엇이 문제고 무엇을 하면 되는지 | 각 화면 문구 |
